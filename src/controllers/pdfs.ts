import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../types';
import { uploadPdfToDrive, deletePdfFromDrive } from '../services/driveService';
import { extractTextFromPdf } from '../services/pdfService';

interface CachedPdf {
  buffer: Buffer;
  filename: string;
  expiresAt: number;
}

const pdfCache = new Map<string, CachedPdf>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Handles PDF upload.
 * Receives file from multer memoryStorage, processes text, uploads to Drive, and logs details.
 */
export async function uploadPdf(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file was uploaded' });
  }

  // Validate mimetype
  if (file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'Only PDF format is supported' });
  }

  // Max 200MB (limit updated in route as well)
  if (file.size > 200 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size exceeds the 200MB limit' });
  }

  const { subjectId } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshTokenEncrypted) {
      return res.status(400).json({ 
        error: 'Google authorization missing. Re-sign-in to authorize Drive access.' 
      });
    }

    // 1. Upload to Google Drive (HiVe folder) using resumable upload for larger files
    const driveFileId = await uploadPdfToDrive(
      user.refreshTokenEncrypted,
      file.buffer,
      file.originalname,
      file.mimetype
    );

    // 2. Save reference to Database immediately with 'processing' status
    const pdf = await prisma.pdf.create({
      data: {
        userId,
        subjectId: subjectId || null,
        filename: file.originalname,
        driveFileId,
        fileSize: file.size,
        extractedText: '',
        status: 'processing',
        source: 'upload',
      },
      select: {
        id: true,
        filename: true,
        driveFileId: true,
        fileSize: true,
        subjectId: true,
        status: true,
        source: true,
        createdAt: true,
      },
    });

    // 3. Process PDF text extraction in background to prevent client timeout
    extractTextFromPdf(file.buffer)
      .then(async (extractedText) => {
        await prisma.pdf.update({
          where: { id: pdf.id },
          data: {
            extractedText,
            status: 'completed',
          },
        });
      })
      .catch(async (error) => {
        console.error(`Async PDF text extraction failed for ID ${pdf.id}:`, error);
        await prisma.pdf.update({
          where: { id: pdf.id },
          data: {
            status: 'failed',
          },
        });
      });

    return res.status(201).json(pdf);
  } catch (error: any) {
    console.error('PDF processing / upload failure:', error);
    return res.status(500).json({ error: `PDF upload failure: ${error.message}` });
  }
}

/**
 * Lists all PDFs for the user, with optional subject_id query filter.
 */
export async function listPdfs(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { subjectId } = req.query;

  try {
    const pdfs = await prisma.pdf.findMany({
      where: {
        userId,
        ...(subjectId ? { subjectId: subjectId as string } : {}),
      },
      select: {
        id: true,
        filename: true,
        driveFileId: true,
        fileSize: true,
        subjectId: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(pdfs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Returns full metadata and extracted text for previewing.
 */
export async function getPdfPreview(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const pdf = await prisma.pdf.findFirst({
      where: { id, userId },
      select: {
        id: true,
        filename: true,
        extractedText: true,
        createdAt: true,
      },
    });

    if (!pdf) {
      return res.status(404).json({ error: 'PDF file not found or access denied' });
    }

    return res.json(pdf);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Removes PDF record from Database and moves Google Drive file to trash.
 */
export async function deletePdf(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const pdf = await prisma.pdf.findFirst({
      where: { id, userId },
    });

    if (!pdf) {
      return res.status(404).json({ error: 'PDF file not found or access denied' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Trash file on Google Drive if token exists
    if (user?.refreshTokenEncrypted) {
      try {
        await deletePdfFromDrive(user.refreshTokenEncrypted, pdf.driveFileId);
      } catch (driveError: any) {
        console.warn(`Unable to trash Drive file ${pdf.driveFileId}:`, driveError.message);
      }
    }

    // Delete DB row
    await prisma.pdf.delete({
      where: { id },
    });

    return res.json({ success: true, message: 'PDF deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Serves the raw PDF file stream for rendering in the browser.
 * Validates ownership, uses local storage if dev path exists, or fetches from Google Drive.
 * Includes in-memory caching.
 */
export async function getPdfFile(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const pdf = await prisma.pdf.findUnique({
      where: { id },
    });

    if (!pdf) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    if (pdf.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: You do not own this PDF' });
    }

    // Serve from cache if available
    const cached = pdfCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${cached.filename}"`);
      return res.send(cached.buffer);
    }

    // 1. Check local file storage fallback (dev mode)
    const { tryReadLocalFile } = require('../services/fileService');
    const localBuffer = tryReadLocalFile(pdf.driveFileId);
    if (localBuffer) {
      pdfCache.set(id, {
        buffer: localBuffer,
        filename: pdf.filename,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
      return res.send(localBuffer);
    }

    // 2. Fetch from Google Drive via dedicated service function
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshTokenEncrypted) {
      return res.status(400).json({ error: 'Google Drive authorization missing' });
    }

    const { downloadPdfFromDrive } = require('../services/driveService');
    const fileBuffer: Buffer = await downloadPdfFromDrive(user.refreshTokenEncrypted, pdf.driveFileId);

    // Cache the downloaded buffer
    pdfCache.set(id, {
      buffer: fileBuffer,
      filename: pdf.filename,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
    return res.send(fileBuffer);
  } catch (error: any) {
    console.error('Error fetching raw PDF file:', error);
    if (error.code === 404 || error.status === 404) {
      return res.status(404).json({ error: 'File not found on Google Drive' });
    }
    return res.status(500).json({ error: `Failed to retrieve file: ${error.message}` });
  }
}
