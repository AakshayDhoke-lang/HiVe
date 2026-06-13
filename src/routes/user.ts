import { Router } from 'express';
import { updateTheme } from '../controllers/auth';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// PATCH /api/user/theme - Update theme preference
router.patch('/theme', authenticateJWT as any, updateTheme);

export default router;
