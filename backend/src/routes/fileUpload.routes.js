import { Router } from "express";
import { uploadStream } from "../controllers/fileUpload.controllers.js";

const router = Router();

// router.route("/upload").post(uploadFile);
router.route("/upload/stream").post(uploadStream);

export default router;