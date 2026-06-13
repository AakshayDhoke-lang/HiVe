import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { downloadPdfFromDrive } from '../services/driveService';
import { tryReadLocalFile } from '../services/fileService';

// Mock the Google Drive service client
jest.mock('../services/driveService', () => ({
  getDriveClient: jest.fn(),
  uploadPdfToDrive: jest.fn().mockResolvedValue('mock-drive-id-123'),
  deletePdfFromDrive: jest.fn().mockResolvedValue(undefined),
  downloadPdfFromDrive: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
}));

// Mock the local file service
jest.mock('../services/fileService', () => ({
  tryReadLocalFile: jest.fn((driveFileId: string) => {
    if (driveFileId === 'local-file-path-123.pdf') {
      return Buffer.from('local-pdf-data');
    }
    return null;
  }),
}));

import router from '../routes';
import prisma from '../config/db';
jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    subject: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    pdf: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    conversation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    aiConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    sharedConversation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    $connect: jest.fn(),
    $queryRaw: jest.fn(),
  },
}));

// Mock Axios for external endpoint tests
jest.mock('axios');

const app = express();
app.use(express.json());
app.use(router);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-signing-key-change-me-in-production';
const mockUserId = 'user-123';
const mockToken = jwt.sign({ id: mockUserId, email: 'test@example.com', name: 'Test User' }, JWT_SECRET);

describe('HiVe API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== Authentication Middleware =====
  describe('Authentication Middleware', () => {
    it('should reject secure routes if Authorization header is missing', async () => {
      const response = await request(app).get('/api/subjects');
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('No token provided');
    });

    it('should reject request with an invalid Bearer token signature', async () => {
      const response = await request(app)
        .get('/api/subjects')
        .set('Authorization', 'Bearer invalid-signature-token');
      expect(response.status).toBe(403);
    });
  });

  // ===== User Theme Preferences =====
  describe('User Theme Preferences', () => {
    it('should update user theme to dark', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        theme: 'dark',
        createdAt: new Date(),
      };
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .patch('/api/user/theme')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ theme: 'dark' });

      expect(response.status).toBe(200);
      expect(response.body.theme).toBe('dark');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { theme: 'dark' },
        select: expect.objectContaining({ theme: true }),
      });
    });

    it('should reject invalid theme values', async () => {
      const response = await request(app)
        .patch('/api/user/theme')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ theme: 'rainbow' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('light, dark, system');
    });

    it('should include theme in getMe response', async () => {
      const mockUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
        theme: 'system',
        createdAt: new Date(),
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.theme).toBe('system');
    });
  });

  // ===== Subjects CRUD =====
  describe('Subjects CRUD API', () => {
    it('should fetch all subjects of the user and output calculated counts', async () => {
      const mockSubjects = [
        {
          id: 'sub-1',
          name: 'General',
          color: 'blue',
          isPublic: false,
          publicApiKey: null,
          createdAt: new Date(),
          _count: { pdfs: 5 },
        },
      ];
      (prisma.subject.findMany as jest.Mock).mockResolvedValue(mockSubjects);

      const response = await request(app)
        .get('/api/subjects')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].pdfCount).toBe(5);
    });

    it('should create a new subject with color', async () => {
      const mockSubject = { id: 'sub-2', name: 'Science', color: 'green' };
      (prisma.subject.create as jest.Mock).mockResolvedValue(mockSubject);

      const response = await request(app)
        .post('/api/subjects')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ name: 'Science', color: 'green' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Science');
    });
  });

  // ===== AI Configuration with Multi-Provider =====
  describe('AI Configuration', () => {
    it('should save AI config with provider_type and use_client_side', async () => {
      const mockConfig = {
        userId: mockUserId,
        providerType: 'lmstudio',
        baseUrl: 'http://localhost:1234/v1',
        model: 'local-model',
        useClientSide: true,
      };
      (prisma.aiConfig.upsert as jest.Mock).mockResolvedValue(mockConfig);

      const response = await request(app)
        .put('/api/ai-config')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          provider_type: 'lmstudio',
          base_url: 'http://localhost:1234/v1',
          api_key: '',
          model: 'local-model',
          use_client_side: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.config.provider_type).toBe('lmstudio');
      expect(response.body.config.use_client_side).toBe(true);
    });

    it('should reject invalid provider_type', async () => {
      const response = await request(app)
        .put('/api/ai-config')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          provider_type: 'invalid-provider',
          base_url: 'http://localhost:1234/v1',
          model: 'model',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid provider type');
    });

    it('should return masked API key (first 5 + last 4 chars)', async () => {
      const mockConfig = {
        providerType: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        // encrypted form of "sk-abcdefghijklmnopqrstuvwxyz1234"
        apiKeyEncrypted: null as any,
        model: 'gpt-4o-mini',
        useClientSide: false,
      };

      // We need to encrypt a test key and store it
      const { encrypt } = require('../config/encryption');
      const testKey = 'sk-abcdefghijklmnopqrstuvwxyz1234';
      mockConfig.apiKeyEncrypted = encrypt(testKey);

      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/api/ai-config')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.configured).toBe(true);
      expect(response.body.provider_type).toBe('openai');
      expect(response.body.use_client_side).toBe(false);
      // Verify masking: first 5 + asterisks + last 4
      const masked = response.body.api_key_masked;
      expect(masked.substring(0, 5)).toBe('sk-ab');
      expect(masked.substring(masked.length - 4)).toBe('1234');
      expect(masked).toContain('*');
      // Ensure full key is never returned
      expect(masked).not.toBe(testKey);
    });
  });

  // ===== Split Message Storage (Client-Side Execution) =====
  describe('Split Message Endpoints', () => {
    it('should save a user message via POST /conversations/:id/user-message', async () => {
      const mockConversation = { id: 'conv-1', userId: mockUserId, title: 'New Chat' };
      const mockMessage = { id: 'msg-1', conversationId: 'conv-1', role: 'user', content: 'What is HiVe?' };

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/conversations/conv-1/user-message')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ content: 'What is HiVe?' });

      expect(response.status).toBe(201);
      expect(response.body.role).toBe('user');
      expect(response.body.content).toBe('What is HiVe?');
    });

    it('should save an assistant message via POST /conversations/:id/assistant-message', async () => {
      const mockConversation = { id: 'conv-1', userId: mockUserId, title: 'What is HiVe?' };
      const mockMessage = {
        id: 'msg-2',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'HiVe is a document Q&A platform.',
        sources: JSON.stringify([{ pdfId: 'pdf-1', filename: 'intro.pdf' }]),
        createdAt: new Date(),
      };

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);

      const response = await request(app)
        .post('/api/conversations/conv-1/assistant-message')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          content: 'HiVe is a document Q&A platform.',
          sources: [{ pdfId: 'pdf-1', filename: 'intro.pdf' }],
        });

      expect(response.status).toBe(201);
      expect(response.body.role).toBe('assistant');
      expect(response.body.sources).toEqual([{ pdfId: 'pdf-1', filename: 'intro.pdf' }]);
    });

    it('should reject empty content on user-message', async () => {
      const response = await request(app)
        .post('/api/conversations/conv-1/user-message')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ content: '' });

      expect(response.status).toBe(400);
    });
  });

  // ===== Conversation Messages Pagination =====
  describe('GET /conversations/:id/messages pagination support', () => {
    it('should support limit parameter to paginate messages', async () => {
      const mockConversation = { id: 'conv-1', userId: mockUserId };
      const mockMessages = [
        { id: 'msg-1', role: 'user', content: 'Msg 1' },
        { id: 'msg-2', role: 'assistant', content: 'Msg 2' },
      ];

      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.message.findMany as jest.Mock).mockResolvedValue(mockMessages);

      const response = await request(app)
        .get('/api/conversations/conv-1/messages?limit=2')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 2,
        })
      );
    });

    it('should return all messages when limit=0 or limit=-1 is passed', async () => {
      const mockConversation = { id: 'conv-1', userId: mockUserId };
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.message.findMany as jest.Mock).mockResolvedValue([]);

      const response0 = await request(app)
        .get('/api/conversations/conv-1/messages?limit=0')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response0.status).toBe(200);
      expect((prisma.message.findMany as jest.Mock).mock.lastCall[0].take).toBeUndefined();

      const responseNeg1 = await request(app)
        .get('/api/conversations/conv-1/messages?limit=-1')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(responseNeg1.status).toBe(200);
      expect((prisma.message.findMany as jest.Mock).mock.lastCall[0].take).toBeUndefined();
    });

    it('should support skip parameter to offset messages', async () => {
      const mockConversation = { id: 'conv-1', userId: mockUserId };
      (prisma.conversation.findFirst as jest.Mock).mockResolvedValue(mockConversation);
      (prisma.message.findMany as jest.Mock).mockResolvedValue([]);

      const response = await request(app)
        .get('/api/conversations/conv-1/messages?skip=5')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(prisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
        })
      );
    });
  });

  // ===== Standalone Retrieval Endpoint =====
  describe('Retrieve API', () => {
    it('should return chunks and sources for a given question', async () => {
      const mockPdfs = [
        {
          id: 'pdf-1',
          filename: 'guide.pdf',
          extractedText: 'HiVe supports Google Drive integration and PDF text extraction for document management.',
        },
        {
          id: 'pdf-2',
          filename: 'faq.pdf',
          extractedText: 'Frequently asked questions about Google Drive upload limits and supported file types.',
        },
      ];
      (prisma.pdf.findMany as jest.Mock).mockResolvedValue(mockPdfs);

      const response = await request(app)
        .post('/api/retrieve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ question: 'Google Drive integration' });

      expect(response.status).toBe(200);
      expect(response.body.chunks).toBeDefined();
      expect(Array.isArray(response.body.chunks)).toBe(true);
      expect(response.body.sources).toBeDefined();
      expect(Array.isArray(response.body.sources)).toBe(true);
      // At least one chunk should match our query about Google Drive
      expect(response.body.chunks.length).toBeGreaterThan(0);
    });

    it('should reject missing question parameter', async () => {
      const response = await request(app)
        .post('/api/retrieve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Question');
    });
  });

  // ===== Public API =====
  describe('Public API chat RAG Flow', () => {
    it('should process questions on public subjects', async () => {
      const mockSubject = { id: 'pub-sub-99', userId: 'owner-888', isPublic: true };
      const mockPdf = {
        id: 'pdf-99',
        filename: 'documentation.pdf',
        extractedText: 'Authentication in HiVe is based on Google OAuth.',
      };

      (prisma.subject.findFirst as jest.Mock).mockResolvedValue(mockSubject);
      (prisma.pdf.findMany as jest.Mock).mockResolvedValue([mockPdf]);
      (prisma.aiConfig.findUnique as jest.Mock).mockResolvedValue(null);

      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: 'HiVe authentication uses Google OAuth. [Source: documentation.pdf]',
              },
            },
          ],
        },
      });

      const response = await request(app)
        .post('/api/public/chat')
        .set('Authorization', 'Bearer hive-public-api-token-secret')
        .send({
          question: 'How does authentication work?',
          subjectId: 'pub-sub-99',
        });

      expect(response.status).toBe(200);
      expect(response.body.reply).toContain('HiVe authentication');
      expect(response.body.sources).toHaveLength(1);
    });

    it('should return 401 Unauthorized if wrong static key is provided', async () => {
      const response = await request(app)
        .post('/api/public/chat')
        .set('Authorization', 'Bearer incorrect-token')
        .send({ question: 'Hello?' });

      expect(response.status).toBe(401);
    });
  });

  // ===== Raw PDF File Streaming =====
  describe('Raw PDF File Streaming API', () => {
    it('should stream PDF from local file storage if available', async () => {
      const mockPdf = {
        id: 'pdf-local',
        userId: mockUserId,
        filename: 'local.pdf',
        driveFileId: 'local-file-path-123.pdf',
        fileSize: 100,
      };
      (prisma.pdf.findUnique as jest.Mock).mockResolvedValue(mockPdf);
      (tryReadLocalFile as jest.Mock).mockReturnValue(Buffer.from('local-pdf-data'));

      const response = await request(app)
        .get('/api/pdfs/pdf-local/file')
        .set('Authorization', `Bearer ${mockToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('inline; filename="local.pdf"');
      expect(response.body.toString()).toBe('local-pdf-data');
    });

    it('should fetch and stream from Google Drive when not local', async () => {
      const mockPdf = {
        id: 'pdf-drive',
        userId: mockUserId,
        filename: 'drive.pdf',
        driveFileId: 'drive-file-id-123',
        fileSize: 100,
      };
      const mockUser = {
        id: mockUserId,
        refreshTokenEncrypted: 'encrypted-token-123',
      };
      (prisma.pdf.findUnique as jest.Mock).mockResolvedValue(mockPdf);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (tryReadLocalFile as jest.Mock).mockReturnValue(null);
      (downloadPdfFromDrive as jest.Mock).mockResolvedValue(Buffer.from('mock-pdf-content'));

      const response = await request(app)
        .get('/api/pdfs/pdf-drive/file')
        .set('Authorization', `Bearer ${mockToken}`)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => callback(null, Buffer.concat(chunks)));
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.body.toString()).toBe('mock-pdf-content');
    });

    it('should return 403 Forbidden if user is not the owner', async () => {
      const mockPdf = {
        id: 'pdf-other',
        userId: 'other-user',
        filename: 'other.pdf',
        driveFileId: 'drive-file-id-123',
      };
      (prisma.pdf.findUnique as jest.Mock).mockResolvedValue(mockPdf);

      const response = await request(app)
        .get('/api/pdfs/pdf-other/file')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Access denied');
    });

    it('should return 404 Not Found if PDF record does not exist', async () => {
      (prisma.pdf.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/pdfs/nonexistent/file')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
    });
  });

  // ===== Chrome Extension Ingest =====
  describe('Chrome Extension Ingest API', () => {
    it('should ingest raw text note and save to Drive', async () => {
      const mockUser = { id: mockUserId, refreshTokenEncrypted: 'token' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.pdf.create as jest.Mock).mockResolvedValue({
        id: 'ingested-note-id',
        filename: 'My note.txt',
      });

      const response = await request(app)
        .post('/api/ingest')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          type: 'text',
          content: 'This is a test note to ingest.',
          title: 'My note',
          subjectId: 'sub-1',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.pdfId).toBe('ingested-note-id');
      expect(response.body.source).toBe('extension');
    });

    it('should ingest URL content after scraping and fetching', async () => {
      const mockUser = { id: mockUserId, refreshTokenEncrypted: 'token' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.pdf.create as jest.Mock).mockResolvedValue({
        id: 'ingested-url-id',
        filename: 'Web Capture - example.com.txt',
      });
      (axios.get as jest.Mock).mockResolvedValue({
        data: '<html><body><script>alert(1)</script><h1>Hello World</h1></body></html>',
      });

      const response = await request(app)
        .post('/api/ingest')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          type: 'url',
          content: 'https://example.com/page',
          subjectId: 'sub-1',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.pdfId).toBe('ingested-url-id');
      expect(axios.get).toHaveBeenCalledWith('https://example.com/page', expect.any(Object));
    });

    it('should ingest base64 encoded PDF file', async () => {
      const mockUser = { id: mockUserId, refreshTokenEncrypted: 'token' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.pdf.create as jest.Mock).mockResolvedValue({
        id: 'ingested-file-id',
        filename: 'uploaded_document.pdf',
      });

      const response = await request(app)
        .post('/api/ingest')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          type: 'file',
          content: Buffer.from('mock-pdf-binary').toString('base64'),
          subjectId: 'sub-1',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.pdfId).toBe('ingested-file-id');
    });
  });

  // ===== Delete & Share Conversations =====
  describe('Delete & Share Conversations API', () => {
    describe('DELETE /api/conversations/:id', () => {
      it('should delete a conversation successfully if owner', async () => {
        (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
          id: 'conv-123',
          userId: mockUserId,
        });
        (prisma.conversation.delete as jest.Mock).mockResolvedValue({});

        const response = await request(app)
          .delete('/api/conversations/conv-123')
          .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(prisma.conversation.delete).toHaveBeenCalledWith({
          where: { id: 'conv-123' },
        });
      });

      it('should return 403 Forbidden if not the owner', async () => {
        (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
          id: 'conv-123',
          userId: 'other-user',
        });

        const response = await request(app)
          .delete('/api/conversations/conv-123')
          .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('You do not own');
      });

      it('should return 404 Not Found if conversation does not exist', async () => {
        (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .delete('/api/conversations/nonexistent')
          .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('POST /api/conversations/:id/share', () => {
      it('should create a share link and unique slug if not already shared', async () => {
        (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
          id: 'conv-123',
          userId: mockUserId,
          messages: [{ id: 'msg-1' }],
        });
        (prisma.sharedConversation.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.sharedConversation.create as jest.Mock).mockResolvedValue({
          slug: 'mock-slug-abc',
        });

        const response = await request(app)
          .post('/api/conversations/conv-123/share')
          .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).toBe(200);
        expect(response.body.slug).toBe('mock-slug-abc');
        expect(response.body.url).toBe('/shared/mock-slug-abc');
      });

      it('should return existing share link details if already shared', async () => {
        (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
          id: 'conv-123',
          userId: mockUserId,
          messages: [{ id: 'msg-1' }],
        });
        (prisma.sharedConversation.findUnique as jest.Mock).mockResolvedValue({
          slug: 'existing-slug-xyz',
        });

        const response = await request(app)
          .post('/api/conversations/conv-123/share')
          .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).toBe(200);
        expect(response.body.slug).toBe('existing-slug-xyz');
        expect(response.body.url).toBe('/shared/existing-slug-xyz');
        expect(prisma.sharedConversation.create).not.toHaveBeenCalled();
      });

      it('should reject sharing an empty conversation with 400 Bad Request', async () => {
        (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
          id: 'conv-123',
          userId: mockUserId,
          messages: [],
        });

        const response = await request(app)
          .post('/api/conversations/conv-123/share')
          .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('empty');
      });
    });

    describe('DELETE /api/conversations/:id/share', () => {
      it('should delete the SharedConversation record to revoke access', async () => {
        (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
          id: 'conv-123',
          userId: mockUserId,
        });
        (prisma.sharedConversation.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

        const response = await request(app)
          .delete('/api/conversations/conv-123/share')
          .set('Authorization', `Bearer ${mockToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(prisma.sharedConversation.deleteMany).toHaveBeenCalledWith({
          where: { conversationId: 'conv-123' },
        });
      });
    });

    describe('GET /api/shared/:slug', () => {
      it('should publicly return shared conversation metadata and messages', async () => {
        const mockShared = {
          slug: 'some-slug-123',
          conversation: {
            title: 'Cool Chat',
            messages: [
              { role: 'user', content: 'hello', sources: null },
              { role: 'assistant', content: 'hi', sources: JSON.stringify([{ filename: 'doc.pdf' }]) },
            ],
          },
        };
        (prisma.sharedConversation.findUnique as jest.Mock).mockResolvedValue(mockShared);

        const response = await request(app)
          .get('/api/shared/some-slug-123');

        expect(response.status).toBe(200);
        expect(response.body.title).toBe('Cool Chat');
        expect(response.body.messages).toHaveLength(2);
        expect(response.body.messages[0]).toEqual({
          role: 'user',
          content: 'hello',
          sources: null,
        });
        expect(response.body.messages[1]).toEqual({
          role: 'assistant',
          content: 'hi',
          sources: [{ filename: 'doc.pdf' }],
        });
      });

      it('should return 404 if shared slug is not found', async () => {
        (prisma.sharedConversation.findUnique as jest.Mock).mockResolvedValue(null);

        const response = await request(app)
          .get('/api/shared/invalid-slug');

        expect(response.status).toBe(404);
      });
    });
  });
});
