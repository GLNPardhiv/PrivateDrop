import Router from "express";
import { uploadFile } from "../controllers/fileUpload.controllers.js";

const router = Router(); 

router.route("/upload").post(uploadFile);

export default router;