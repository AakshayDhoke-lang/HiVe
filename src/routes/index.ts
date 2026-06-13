import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './user';
import subjectRoutes from './subjects';
import pdfRoutes from './pdfs';
import conversationRoutes from './conversations';
import retrieveRoutes from './retrieve';
import settingsRoutes from './settings';
import publicRoutes from './public';
import ingestRoutes from './ingest';
import sharedRoutes from './shared';

const router = Router();

// Auth routes
router.use('/auth', authRoutes);

// Protected Core features
router.use('/api/user', userRoutes);
router.use('/api/subjects', subjectRoutes);
router.use('/api/pdfs', pdfRoutes);
router.use('/api/conversations', conversationRoutes);
router.use('/api/retrieve', retrieveRoutes);
router.use('/api/ai-config', settingsRoutes);
router.use('/api/ingest', ingestRoutes);

// Public API
router.use('/api/public', publicRoutes);
router.use('/api/shared', sharedRoutes);

export default router;
