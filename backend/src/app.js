import express from "express";
import helmet from "helmet";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet({ hsts: false }));

// Add this before your route definitions
app.use(cors({
  origin: ['http://localhost:5173', 'https://localhost:5173'], // Allow Vite's dev server
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Filename', 'X-Original-Size', 'X-Encrypted-Size', 'Accept-Encoding'],
  exposedHeaders: ['X-Plaintext-Size'] // Needed for the download side!
}));

import healthCheckRouter from "./routes/healthCheck.routes.js";
app.use("/api/v1/health", healthCheckRouter);

import fileUploadRouter from "./routes/fileUpload.routes.js";
app.use("/api/v1/users", fileUploadRouter);

import fileDownloadRouter from "./routes/fileDownload.routes.js";
app.use("/api/v1/files", fileDownloadRouter);

export default app;