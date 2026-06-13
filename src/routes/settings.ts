import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { saveAiConfig, getAiConfig, testAiConfig } from '../controllers/settings';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

// Stricter rate limit on the test endpoint to prevent abuse
const testLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many test requests. Try again in a minute.' },
});

router.put('/', saveAiConfig);
router.get('/', getAiConfig);
router.post('/test', testLimiter, testAiConfig);

export default router;
