import express from "express";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import healthCheckRouter from "./routes/healthCheck.routes.js";
app.use("/api/v1/health", healthCheckRouter);

import fileUploadRouter from "./routes/fileUpload.routes.js";
app.use("/api/v1/users", fileUploadRouter);

export default app;