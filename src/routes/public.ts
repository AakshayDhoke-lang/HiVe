import { Router } from 'express';
import { handlePublicChat } from '../controllers/public';

const router = Router();

router.post('/chat', handlePublicChat);

export default router;
