import { Router } from 'express';
import multer from 'multer';
import { uploadPdf, listPdfs, getPdfPreview, deletePdf, getPdfFile } from '../controllers/pdfs';
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

// Route mappings
router.post('/', upload.single('file'), uploadPdf);
router.get('/', listPdfs);
router.get('/:id/preview', getPdfPreview);
router.get('/:id/file', getPdfFile);
router.delete('/:id', deletePdf);

export default router;
