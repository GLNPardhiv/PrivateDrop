import { S3Client, HeadObjectCommand, GetObjectCommand, DeleteObjectsCommand, ListObjectVersionsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { PassThrough } from 'stream';
import dotenv from 'dotenv';
dotenv.config();

// S3 Client – we name it `s3` for brevity
const s3 = new S3Client({
  region: 'ap-northeast-1',  // or your region (e.g., 'e2-1', 'e2-2', etc.)
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true, // Keep this – IDrive e2 supports it
});

const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * Upload a readable stream to S3 using multipart upload.
 * Returns a PassThrough stream that you can pipe into, and a promise that resolves when the upload finishes.
 * @param {string} key - Object key
 * @param {string} contentType - MIME type
 * @param {number} highWaterMark - Internal buffer size (default 1 MB)
 */
export const uploadStreamToS3 = (key, contentType, highWaterMark = 10 * 1024 * 1024) => {
  const pass = new PassThrough({ highWaterMark });
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: pass,
      ContentType: contentType,
    },
    partSize: 50 * 1024 * 1024, // 10 MB parts – fewer parts = less overhead
    queueSize: 8, // Concurrent uploads
    leavePartsOnError: false,
  });
  pass.on('error', (err) => console.error('PassThrough error:', err));
  return { pass, uploadPromise: upload.done() };
};

// Other functions (getObjectStream, getObjectMetadata, deleteObjectPermanently, cleanupExpiredFiles) remain the same.
export const getObjectStream = (key) => {
  return s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
};

export const getObjectMetadata = (key) => {
  return s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
};

export const deleteObject = async (key) => {
  const listVersions = await s3.send(new ListObjectVersionsCommand({
    Bucket: BUCKET,
    Prefix: key,
  }));
  const versions = [...(listVersions.Versions || []), ...(listVersions.DeleteMarkers || [])];
  if (versions.length === 0) return;
  await s3.send(new DeleteObjectsCommand({
    Bucket: BUCKET,
    Delete: { Objects: versions.map(v => ({ Key: v.Key, VersionId: v.VersionId })), Quiet: true },
  }));
};

import { File } from '../models/fileMetadata.models.js';

export const cleanupExpiredFiles = async () => {
  const now = new Date();
  const expired = await File.find({ expirationDate: { $lt: now } });
  for (const file of expired) {
    try {
      await deleteObject(file.storageKey);
      await file.deleteOne();
      console.log(`🗑️ Deleted expired file: ${file.originalName}`);
    } catch (err) {
      console.error(`Failed to delete ${file.storageKey}:`, err.message);
    }
  }
};