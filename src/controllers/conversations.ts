import { Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/db';
import { AuthRequest } from '../types';
import { retrieveContextForSubject, chunkText, searchChunks } from '../services/retrievalService';
import { callAIForUser, ChatMessage } from '../services/aiService';

/**
 * Creates a new conversation, optionally linked to a specific subject.
 */
export async function createConversation(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { title, subjectId } = req.body;
  const conversationTitle = title?.trim() || 'New Chat';

  try {
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        subjectId: subjectId || null,
        title: conversationTitle,
      },
    });

    return res.status(201).json(conversation);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Lists all conversations for the user, filterable by subjectId.
 */
export async function listConversations(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { subjectId } = req.query;

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        userId,
        ...(subjectId ? { subjectId: subjectId as string } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(conversations);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Loads all messages inside a specific conversation.
 */
export async function getConversationMessages(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { limit, skip } = req.query;

  try {
    // Verify conversation ownership
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found or access denied' });
    }

    const queryOptions: any = {
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    };

    if (limit !== undefined) {
      const limitStr = String(limit).trim();
      if (limitStr !== '0' && limitStr !== '-1') {
        const limitVal = parseInt(limitStr, 10);
        if (!isNaN(limitVal) && limitVal > 0) {
          queryOptions.take = limitVal;
        }
      }
    }

    if (skip !== undefined) {
      const skipStr = String(skip).trim();
      const skipVal = parseInt(skipStr, 10);
      if (!isNaN(skipVal) && skipVal >= 0) {
        queryOptions.skip = skipVal;
      }
    }

    const messages = await prisma.message.findMany(queryOptions);

    // Parse sources JSON back to object
    const formatted = messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      sources: msg.sources ? JSON.parse(msg.sources) : null,
      createdAt: msg.createdAt,
    }));

    return res.json(formatted);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Handles sending a user message, invoking context retrieval, and getting AI completion response.
 */
export async function sendMessage(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params; // Conversation ID
  const { content } = req.body; // Message content

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'Content must be a non-empty string' });
  }

  try {
    // 1. Verify conversation ownership
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found or access denied' });
    }

    // 2. Load existing messages (limit to last 10 for AI context memory)
    const existingMessages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Save new user message
    const userMessage = await prisma.message.create({
      data: {
        conversationId: id,
        role: 'user',
        content: content.trim(),
      },
    });

    // 4. Retrieve context from PDF database based on the query and subject context
    const { context, sources } = await retrieveContextForSubject(
      userId,
      conversation.subjectId,
      content
    );

    // 5. Construct prompt system instruction including documents context
    const systemPrompt = `You are HiVe, a professional AI assistant. You help users answer questions using their uploaded PDF documents.

Below is the relevant context extracted from the user's PDF documents:
---
${context || 'No documents are currently uploaded or contain information matching this query.'}
---

Guidelines:
1. Answer the user's question as accurately as possible based ONLY on the context provided above.
2. If the context does not contain the answer, say "I could not find the answer in the provided documents." and try to explain what is missing or provide a general response if appropriate, but clearly state it is not in the documents.
3. Include reference citations to the sources (e.g. "[Source: filename]") in your response where appropriate. Do not make up source names.
`;

    // 6. Format chat history for OpenAI endpoint
    const conversationHistory: ChatMessage[] = existingMessages
      .slice(-10) // Select last 10 messages for safety & token limits
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    // 7. Invoke AI client
    const aiResult = await callAIForUser(
      userId,
      systemPrompt,
      content,
      conversationHistory
    );

    // 8. Save AI reply in Database
    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: id,
        role: 'assistant',
        content: aiResult.text,
        sources: JSON.stringify(sources), // Serialize source metadata
      },
    });

    // 9. If conversation title is "New Chat", auto-rename it based on the first query
    if (conversation.title === 'New Chat') {
      const generatedTitle = content.length > 30 ? `${content.substring(0, 30)}...` : content;
      await prisma.conversation.update({
        where: { id },
        data: { title: generatedTitle },
      });
    }

    return res.status(201).json({
      userMessage,
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        sources,
        createdAt: assistantMessage.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Send message failure:', error);
    return res.status(500).json({ error: `Message processing failure: ${error.message}` });
  }
}

/**
 * Saves a user message to a conversation. Used in client-side execution modes.
 */
export async function saveUserMessage(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { content } = req.body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'Content is a required non-empty string' });
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found or access denied' });
    }

    const userMessage = await prisma.message.create({
      data: {
        conversationId: id,
        role: 'user',
        content: content.trim(),
      },
    });

    // Auto-rename title if it remains "New Chat"
    if (conversation.title === 'New Chat') {
      const generatedTitle = content.length > 30 ? `${content.substring(0, 30)}...` : content;
      await prisma.conversation.update({
        where: { id },
        data: { title: generatedTitle },
      });
    }

    return res.status(201).json(userMessage);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Saves an assistant message to a conversation. Used in client-side execution modes.
 */
export async function saveAssistantMessage(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { content, sources } = req.body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'Content is a required non-empty string' });
  }

  try {
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found or access denied' });
    }

    const assistantMessage = await prisma.message.create({
      data: {
        conversationId: id,
        role: 'assistant',
        content: content.trim(),
        sources: sources ? JSON.stringify(sources) : null,
      },
    });

    return res.status(201).json({
      id: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      sources: sources || null,
      createdAt: assistantMessage.createdAt,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Standalone document chunk retrieval API (POST /api/retrieve).
 */
export async function retrieveContextHandler(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { question, subjectId } = req.body;

  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ error: 'Question parameter is required and must be a string' });
  }

  try {
    const pdfs = await prisma.pdf.findMany({
      where: {
        userId,
        ...(subjectId ? { subjectId } : {}),
      },
      select: {
        id: true,
        filename: true,
        extractedText: true,
      },
    });

    const allChunks = [];
    for (const pdf of pdfs) {
      const chunks = chunkText(pdf.extractedText, pdf.id, pdf.filename);
      allChunks.push(...chunks);
    }

    const topMatches = searchChunks(question, allChunks);

    const formattedChunks = topMatches.map((c: any) => ({
      text: c.text,
      source: c.filename,
    }));

    const uniqueSources = Array.from(new Set(topMatches.map((c: any) => c.filename)));

    return res.json({
      chunks: formattedChunks,
      sources: uniqueSources,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Deletes a conversation permanently (along with all its messages and shared state via DB cascade).
 */
export async function deleteConversation(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this conversation' });
    }

    await prisma.conversation.delete({
      where: { id },
    });

    return res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Returns existing share link for a conversation without creating one.
 */
export async function getConversationShare(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this conversation' });
    }

    const shared = await prisma.sharedConversation.findUnique({
      where: { conversationId: id },
    });

    if (!shared) {
      return res.status(404).json({ error: 'Conversation is not shared' });
    }

    return res.json({
      url: `/shared/${shared.slug}`,
      slug: shared.slug,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Creates or retrieves a public read-only share link for a conversation.
 */
export async function shareConversation(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, userId: true, messages: { take: 1 } },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this conversation' });
    }

    if (conversation.messages.length === 0) {
      return res.status(400).json({ error: 'Cannot share an empty conversation' });
    }

    // Check if it's already shared
    let shared = await prisma.sharedConversation.findUnique({
      where: { conversationId: id },
    });

    if (!shared) {
      const slug = crypto.randomBytes(6).toString('hex');
      shared = await prisma.sharedConversation.create({
        data: {
          conversationId: id,
          userId,
          slug,
        },
      });
    }

    return res.json({
      url: `/shared/${shared.slug}`,
      slug: shared.slug,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Revokes public access to a conversation by deleting its SharedConversation record.
 */
export async function revokeShare(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (conversation.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this conversation' });
    }

    // Delete the shared conversation record if it exists
    await prisma.sharedConversation.deleteMany({
      where: { conversationId: id },
    });

    return res.json({ success: true, message: 'Share link revoked successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
