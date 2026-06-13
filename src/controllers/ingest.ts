import { Response } from 'express';
import prisma from '../config/db';
import { AuthRequest } from '../types';
import { uploadPdfToDrive } from '../services/driveService';
import { extractTextFromPdf } from '../services/pdfService';
import axios from 'axios';

// A helper to clean/extract text from URL content
async function extractTextFromUrl(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = res.data;
    if (typeof html !== 'string') return '';
    // Strip script and style tags, then extract content
    let text = html
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text;
  } catch (err: any) {
    throw new Error(`Failed to fetch URL content: ${err.message}`);
  }
}

/**
 * Ingests content from Chrome Extension / Capsule Hub (notes, URLs, or files).
 * Saves content to Google Drive and registers search chunks.
 */
export async function ingestContent(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  let type = req.body.type;
  let content = req.body.content;
  let subjectId = req.body.subjectId;
  let title = req.body.title || req.body.filename;

  // Verify google auth
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.refreshTokenEncrypted) {
    return res.status(400).json({ error: 'Google Drive authorization missing' });
  }

  try {
    // If it's a multipart file upload (type: file)
    if (req.file) {
      const file = req.file;
      if (file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'Only PDF files are supported for file uploads' });
      }

      const driveFileId = await uploadPdfToDrive(
        user.refreshTokenEncrypted,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      const pdf = await prisma.pdf.create({
        data: {
          userId,
          subjectId: subjectId || null,
          filename: file.originalname,
          driveFileId,
          fileSize: file.size,
          extractedText: '',
          status: 'processing',
          source: 'extension',
        },
      });

      // Background text extraction
      extractTextFromPdf(file.buffer)
        .then(async (extractedText) => {
          await prisma.pdf.update({
            where: { id: pdf.id },
            data: { extractedText, status: 'completed' },
          });
        })
        .catch(async (err) => {
          console.error(`Async extraction failed in ingest:`, err);
          await prisma.pdf.update({
            where: { id: pdf.id },
            data: { status: 'failed' },
          });
        });

      return res.status(201).json({
        success: true,
        pdfId: pdf.id,
        filename: pdf.filename,
        source: 'extension',
        status: 'processing'
      });
    }

    // JSON payload API path
    if (!type) {
      return res.status(400).json({ error: "Missing 'type' in payload (text, url, or file)" });
    }

    if (type === 'file') {
      if (!content) {
        return res.status(400).json({ error: "Missing 'content' (base64 string) for type 'file'" });
      }
      const filename = title || 'uploaded_document.pdf';
      const fileBuffer = Buffer.from(content, 'base64');

      const driveFileId = await uploadPdfToDrive(
        user.refreshTokenEncrypted,
        fileBuffer,
        filename,
        'application/pdf'
      );

      const pdf = await prisma.pdf.create({
        data: {
          userId,
          subjectId: subjectId || null,
          filename,
          driveFileId,
          fileSize: fileBuffer.length,
          extractedText: '',
          status: 'processing',
          source: 'extension',
        },
      });

      extractTextFromPdf(fileBuffer)
        .then(async (extractedText) => {
          await prisma.pdf.update({
            where: { id: pdf.id },
            data: { extractedText, status: 'completed' },
          });
        })
        .catch(async (err) => {
          console.error(`Async extraction failed in ingest (base64):`, err);
          await prisma.pdf.update({
            where: { id: pdf.id },
            data: { status: 'failed' },
          });
        });

      return res.status(201).json({
        success: true,
        pdfId: pdf.id,
        filename,
        source: 'extension',
        status: 'processing'
      });
    }

    if (type === 'text') {
      if (!content) {
        return res.status(400).json({ error: "Missing 'content' for type 'text'" });
      }
      const filename = `${title || 'Captured Note'}.txt`;
      const fileBuffer = Buffer.from(content, 'utf-8');

      // Upload text note to Google Drive
      const driveFileId = await uploadPdfToDrive(
        user.refreshTokenEncrypted,
        fileBuffer,
        filename,
        'text/plain'
      );

      const pdf = await prisma.pdf.create({
        data: {
          userId,
          subjectId: subjectId || null,
          filename,
          driveFileId,
          fileSize: fileBuffer.length,
          extractedText: content,
          status: 'completed',
          source: 'extension',
        },
      });

      return res.status(201).json({
        success: true,
        pdfId: pdf.id,
        filename,
        source: 'extension',
        status: 'completed'
      });
    }

    if (type === 'url') {
      if (!content) {
        return res.status(400).json({ error: "Missing 'content' (URL string) for type 'url'" });
      }
      const url = content;
      let host = 'webpage';
      try {
        const parsedUrl = new URL(url);
        host = parsedUrl.hostname;
      } catch {
        // Fallback for invalid URLs
      }
      const filename = `${title || 'Web Capture - ' + host}.txt`;

      // Extract text content from the URL
      const extractedText = await extractTextFromUrl(url);
      const fileBuffer = Buffer.from(extractedText, 'utf-8');

      // Upload text file to Google Drive
      const driveFileId = await uploadPdfToDrive(
        user.refreshTokenEncrypted,
        fileBuffer,
        filename,
        'text/plain'
      );

      const pdf = await prisma.pdf.create({
        data: {
          userId,
          subjectId: subjectId || null,
          filename,
          driveFileId,
          fileSize: fileBuffer.length,
          extractedText,
          status: 'completed',
          source: 'extension',
        },
      });

      return res.status(201).json({
        success: true,
        pdfId: pdf.id,
        filename,
        source: 'extension',
        status: 'completed'
      });
    }

    return res.status(400).json({ error: `Unsupported type '${type}'. Must be text, url, or file.` });

  } catch (error: any) {
    console.error('Ingest error:', error);
    return res.status(500).json({ error: `Ingest process failure: ${error.message}` });
  }
}
