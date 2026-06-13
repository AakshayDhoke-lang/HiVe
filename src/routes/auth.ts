import { Router } from 'express';
import { redirectToGoogle, handleGoogleCallback, getMe, logout } from '../controllers/auth';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// OAuth initiation and callback routes
router.get('/google', redirectToGoogle);
router.get('/google/callback', handleGoogleCallback);

// Profile and logout
router.get('/me', authenticateJWT as any, getMe);
router.post('/logout', logout);

export default router;
