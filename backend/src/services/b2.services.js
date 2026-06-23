import { S3Client, HeadObjectCommand, ListObjectVersionsCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { PassThrough } from 'stream';
import dotenv from 'dotenv';
dotenv.config();

// S3 Client configuration (same as before)
const s3Client = new S3Client({
  region: 'us-east-005', // your region
  endpoint: process.env.B2_ENDPOINT, // must include https://
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

/**
 * Upload a readable stream to B2 using multipart upload.
 * Returns a PassThrough stream that you can pipe into, and a promise that resolves when the upload finishes.
 */
export const uploadStreamToB2 = (key, contentType) => {
  const pass = new PassThrough();
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.B2_BUCKET_NAME,
      Key: key,
      Body: pass,
      ContentType: contentType,
    },
    // Optional: configure part size (default 5 MB)
    // partSize: 5 * 1024 * 1024,
    leavePartsOnError: false, // automatically clean up failed parts
  });

  const uploadPromise = upload.done();
  return { pass, uploadPromise };
};

/**
 * Download a file stream from B2
 * @param {string} key - Object key
 * @returns {Promise<{ Body: ReadableStream, ContentLength: number, ContentType: string }>}
 */
export const getObjectStream = async (key) => {
    const command = new GetObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: key,
    });
    return s3Client.send(command);
};

/**
 * Get file metadata (size, etc.)
 * @param {string} key - Object key
 * @returns {Promise<{ ContentLength: number, ContentType: string }>}
 */
export const getObjectMetadata = async (key) => {
    const command = new HeadObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: key,
    });
    return s3Client.send(command);
};

/**
 * Permanently delete an object and all its versions from B2.
 */
export const deleteObject = async (key) => {
  // First, list all versions of the object.
  const listVersionsCommand = new ListObjectVersionsCommand({
    Bucket: process.env.B2_BUCKET_NAME,
    Prefix: key,
  });
  const { Versions, DeleteMarkers } = await s3Client.send(listVersionsCommand);

  const objectsToDelete = [];

  // Add all versions
  if (Versions) {
    Versions.forEach(version => {
      objectsToDelete.push({ Key: version.Key, VersionId: version.VersionId });
    });
  }

  // Add all delete markers (if any)
  if (DeleteMarkers) {
    DeleteMarkers.forEach(marker => {
      objectsToDelete.push({ Key: marker.Key, VersionId: marker.VersionId });
    });
  }

  if (objectsToDelete.length === 0) {
    console.log(`ℹ️ No versions found for key: ${key}`);
    return;
  }

  // Delete all versions in batches (up to 1000 per request)
  while (objectsToDelete.length > 0) {
    const batch = objectsToDelete.splice(0, 1000);
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Delete: { Objects: batch, Quiet: true },
    });
    await s3Client.send(deleteCommand);
    console.log(`🗑️ Deleted ${batch.length} version(s) of ${key}`);
  }
};