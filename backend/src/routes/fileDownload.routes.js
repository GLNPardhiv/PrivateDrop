import Router from 'express';
import { downloadFile, getFileInfo } from '../controllers/fileDownload.controllers.js';

const router = Router();

router.route('/info/:fileId').get(getFileInfo);
router.route('/download/:fileId').get(downloadFile);

export default router;