import { Request, Response } from 'express';
import prisma from '../config/db';
import { retrieveContextForSubject, chunkText, searchChunks } from '../services/retrievalService';
import { callAIForUser } from '../services/aiService';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_PUBLIC_API_KEY = process.env.PUBLIC_API_KEY || 'hive-public-api-token-secret';

/**
 * Handles public document Q&A queries.
 * Requires static token authorization (PUBLIC_API_KEY) in header and accepts question,
 * optional subjectId, and optional AI configurations overrides.
 */
export async function handlePublicChat(req: Request, res: Response) {
  // 1. Static API key verification
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-public-api-key'];
  
  let clientKey = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    clientKey = authHeader.split(' ')[1];
  } else if (typeof apiKeyHeader === 'string') {
    clientKey = apiKeyHeader;
  }

  if (clientKey !== SERVER_PUBLIC_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing Public API Key' });
  }

  const { question, subjectId, aiConfig } = req.body;

  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({ error: 'Body parameter "question" is required and must be a string' });
  }

  try {
    let pdfOwnerId = '';
    let contextChunksText = '';
    let sources: Array<{ pdfId: string; filename: string }> = [];

    // 2. Retrieve context depending on query parameters (specific public subject or all public subjects)
    if (subjectId) {
      const subject = await prisma.subject.findFirst({
        where: { id: subjectId, isPublic: true },
      });

      if (!subject) {
        return res.status(404).json({ error: 'Public subject not found or is set to private' });
      }

      pdfOwnerId = subject.userId;
      const retrieval = await retrieveContextForSubject(pdfOwnerId, subjectId, question);
      contextChunksText = retrieval.context;
      sources = retrieval.sources;
    } else {
      // Find all public subjects on the platform
      const publicSubjects = await prisma.subject.findMany({
        where: { isPublic: true },
        select: { id: true, userId: true },
      });

      if (publicSubjects.length === 0) {
        return res.json({
          reply: 'I could not find any public knowledge bases configured on this server.',
          sources: [],
        });
      }

      const publicSubjectIds = publicSubjects.map((s: any) => s.id);
      
      // Fetch public PDFs
      const pdfs = await prisma.pdf.findMany({
        where: {
          subjectId: { in: publicSubjectIds },
        },
        select: {
          id: true,
          filename: true,
          extractedText: true,
          userId: true,
        },
      });

      if (pdfs.length === 0) {
        return res.json({
          reply: 'Public database has no document resources uploaded yet.',
          sources: [],
        });
      }

      // Chunk and search
      const allChunks = [];
      for (const pdf of pdfs) {
        const chunks = chunkText(pdf.extractedText, pdf.id, pdf.filename);
        allChunks.push(...chunks);
      }

      const topMatches = searchChunks(question, allChunks);
      contextChunksText = topMatches.map((c, i) => `[Source ${i + 1}: ${c.filename}]\n${c.text}\n`).join('\n');
      
      const uniqueMap = new Map<string, string>();
      topMatches.forEach(c => uniqueMap.set(c.pdfId, c.filename));
      sources = Array.from(uniqueMap.entries()).map(([pdfId, filename]) => ({
        pdfId,
        filename,
      }));

      // Set fallback owner to run AI configuration permissions
      pdfOwnerId = pdfs[0].userId;
    }

    // 3. Construct prompt instructing the model
    const systemPrompt = `You are HiVe, a public document bot answering queries using public text archives.

Below is the relevant context extracted from public document libraries:
---
${contextChunksText || 'No public information matches this query.'}
---

Guidelines:
1. Answer the question based ONLY on the context provided above.
2. If the context does not contain the answer, say "I could not find the answer in the public documents."
3. Cite sources (e.g. "[Source: filename]") when answering.
`;

    // 4. Dispatch call to AI service
    const aiResult = await callAIForUser(
      pdfOwnerId,
      systemPrompt,
      question,
      [],
      aiConfig // Support client config overrides
    );

    return res.json({
      reply: aiResult.text,
      sources,
      modelUsed: aiResult.modelUsed,
    });

  } catch (error: any) {
    console.error('Public Q&A endpoint failure:', error);
    return res.status(500).json({ error: `Public Q&A processing error: ${error.message}` });
  }
}
