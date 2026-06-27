import { APIError } from '../utils/APIError.js';
import { APIResponse } from '../utils/APIResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getObjectStream } from '../services/s3.services.js';
import { File } from '../models/fileMetadata.models.js';

export const getFileInfo = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const metadata = await File.findById(fileId);
  if (!metadata) throw new APIError(404, 'File not found');
  if (new Date() > metadata.expirationDate) throw new APIError(410, 'File has expired');
  res.status(200).json(new APIResponse(200, {
    fileId: metadata._id,
    originalName: metadata.originalName,
    mimeType: metadata.mimeType,
    originalSize: metadata.originalSize,
    size: metadata.size,
    expirationDate: metadata.expirationDate,
  }));
});

export const downloadFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const metadata = await File.findById(fileId);
  if (!metadata) throw new APIError(404, 'File not found');
  if (new Date() > metadata.expirationDate) throw new APIError(410, 'File has expired');

  const { Body, ContentLength, ContentType } = await getObjectStream(metadata.storageKey);

  if (!Body) {
    throw new APIError(500, 'Empty stream from S3');
  }

  const plaintextSize = metadata.originalSize || metadata.size;
  res.set({
    'Content-Type': ContentType || metadata.mimeType,
    'Content-Disposition': `attachment; filename="${metadata.originalName}"`,
    'Content-Length': ContentLength || metadata.size,
    'X-Plaintext-Size': plaintextSize,
  });

  // FIX: Stream directly from S3 to the client. Let Node.js handle the backpressure natively.
  Body.pipe(res); 
});