import { Router } from 'express';
import { createSubject, listSubjects, updateSubject, deleteSubject } from '../controllers/subjects';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT as any);

router.post('/', createSubject);
router.get('/', listSubjects);
router.put('/:id', updateSubject);
router.delete('/:id', deleteSubject);

export default router;
