import { Router } from 'express';
import { 
  createConversation, 
  listConversations, 
  getConversationMessages, 
  sendMessage,
  saveUserMessage,
  saveAssistantMessage,
  deleteConversation,
  getConversationShare,
  shareConversation,
  revokeShare
} from '../controllers/conversations';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

// Standard conversation routes
router.post('/', createConversation);
router.get('/', listConversations);
router.get('/:id/messages', getConversationMessages);
router.post('/:id/messages', sendMessage);
router.delete('/:id', deleteConversation);

// Share conversation routes
router.get('/:id/share', getConversationShare);
router.post('/:id/share', shareConversation);
router.delete('/:id/share', revokeShare);

// Split message storage routes (for client-side execution modes)
router.post('/:id/user-message', saveUserMessage);
router.post('/:id/assistant-message', saveAssistantMessage);

export default router;
