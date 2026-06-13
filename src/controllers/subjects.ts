import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../types';

/**
 * Creates a new subject under the authenticated user.
 */
export async function createSubject(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { name, color, isPublic, publicApiKey } = req.body;
  if (!name || !color) {
    return res.status(400).json({ error: 'Name and color fields are required' });
  }

  try {
    const subject = await prisma.subject.create({
      data: {
        userId,
        name,
        color,
        isPublic: typeof isPublic === 'boolean' ? isPublic : false,
        publicApiKey: publicApiKey?.trim() || null,
      },
    });
    return res.status(201).json(subject);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Lists all subjects for the user along with PDF document counts and public settings.
 */
export async function listSubjects(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const subjects = await prisma.subject.findMany({
      where: { userId },
      include: {
        _count: {
          select: { pdfs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten count representation
    const result = subjects.map(sub => ({
      id: sub.id,
      name: sub.name,
      color: sub.color,
      isPublic: sub.isPublic,
      publicApiKey: sub.publicApiKey,
      createdAt: sub.createdAt,
      pdfCount: sub._count.pdfs,
    }));

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Updates a subject's metadata (name/color/public options).
 */
export async function updateSubject(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const { name, color, isPublic, publicApiKey } = req.body;

  try {
    const subject = await prisma.subject.findFirst({
      where: { id, userId },
    });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(color ? { color } : {}),
        ...(typeof isPublic === 'boolean' ? { isPublic } : {}),
        ...(publicApiKey !== undefined ? { publicApiKey: publicApiKey?.trim() || null } : {}),
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Deletes a subject. Cascade/SetNull is configured at database/prisma level.
 */
export async function deleteSubject(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const subject = await prisma.subject.findFirst({
      where: { id, userId },
    });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    await prisma.subject.delete({
      where: { id },
    });

    return res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
