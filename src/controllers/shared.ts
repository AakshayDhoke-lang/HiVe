import { Request, Response } from 'express';
import prisma from '../config/db';

/**
 * Public access endpoint to fetch a shared conversation by slug.
 * No authentication required.
 */
export async function getSharedConversation(req: Request, res: Response) {
  const { slug } = req.params;

  try {
    const share = await prisma.sharedConversation.findUnique({
      where: { slug },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!share) {
      return res.status(404).json({ error: 'Shared conversation not found' });
    }

    const formattedMessages = share.conversation.messages.map((m: any) => ({
      role: m.role,
      content: m.content,
      sources: m.sources ? JSON.parse(m.sources) : null,
    }));

    return res.json({
      title: share.conversation.title || 'Untitled',
      messages: formattedMessages,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
