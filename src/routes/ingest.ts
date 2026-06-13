import { Router } from 'express';
import multer from 'multer';
import { ingestContent } from '../controllers/ingest';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Configure multer with in-memory storage and 200MB max file limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

router.use(authenticateJWT as any);

// POST /api/ingest - ingest captured notes, URLs, or files
router.post('/', upload.single('file'), ingestContent);

export default router;
