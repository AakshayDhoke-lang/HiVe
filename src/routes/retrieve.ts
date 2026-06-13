import { Router } from 'express';
import { retrieveContextHandler } from '../controllers/conversations';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

// POST /api/retrieve - standalone chunk retrieval for client-side AI execution
router.post('/', retrieveContextHandler);

export default router;
