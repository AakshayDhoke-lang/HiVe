import { Router } from 'express';
import { getSharedConversation } from '../controllers/shared';

const router = Router();

router.get('/:slug', getSharedConversation);

export default router;
