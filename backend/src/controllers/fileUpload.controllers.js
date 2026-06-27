import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import busboy from "busboy";
import { randomUUID } from 'crypto';
import { uploadStreamToS3, getObjectMetadata } from '../services/s3.services.js';
import { File } from '../models/fileMetadata.models.js';
import { pipeline, Transform } from 'stream';
import { promisify } from 'util';

const pipelineAsync = promisify(pipeline);

/**
 * Buffering Transform – coalesces small chunks into larger ones.
 * Reduces the number of writes to the S3 upload stream.
 */
class BufferTransform extends Transform {
  constructor(options = {}) {
    super(options);
    this.chunks = [];
    this.pendingSize = 0;
    this.targetSize = options.targetSize || 1024 * 1024; // 1 MB default
  }

  _transform(chunk, encoding, callback) {
    this.chunks.push(chunk);
    this.pendingSize += chunk.length;
    while (this.pendingSize >= this.targetSize) {
      const extract = [];
      let need = this.targetSize;
      while (need > 0 && this.chunks.length > 0) {
        const first = this.chunks[0];
        const give = Math.min(first.length, need);
        extract.push(first.subarray(0, give));
        need -= give;
        if (give >= first.length) {
          this.chunks.shift();
        } else {
          this.chunks[0] = first.subarray(give);
        }
      }
      this.pendingSize -= this.targetSize;
      const buf = Buffer.concat(extract);
      this.push(buf);
    }
    callback();
  }

  _flush(callback) {
    if (this.pendingSize > 0) {
      const remaining = Buffer.concat(this.chunks);
      this.push(remaining);
    }
    callback();
  }
}

// ============ Multipart Upload (legacy) ============
// export const uploadFile = asyncHandler(async (req, res) => {
//   const startTime = Date.now();
//   const bb = busboy({ headers: req.headers });

//   let fileinfo = {};
//   let fileFound = false;

//   const uploadPromise = new Promise((resolve, reject) => {
//     bb.on("file", (fieldname, stream, fileInfo) => {
//       fileFound = true;
//       fileinfo.originalName = fileInfo.filename;
//       fileinfo.mimeType = fileInfo.mimeType || 'application/octet-stream';
//       const key = `${Date.now()}-${randomUUID()}-${fileInfo.filename}`;
//       fileinfo.storageKey = key;

//       const { pass, uploadPromise } = uploadStreamToB2(key, fileinfo.mimeType);
//       stream.pipe(pass)
//         .on('error', reject)
//         .on('finish', async () => {
//           try {
//             await uploadPromise;
//             const head = await getObjectMetadata(key);
//             fileinfo.size = head.ContentLength || 0;
//             resolve();
//           } catch (err) { reject(err); }
//         });
//     });

//     bb.on('finish', () => {
//       if (!fileFound) reject(new Error('No file uploaded'));
//     });
//     bb.on('error', reject);
//   });

//   req.pipe(bb);
//   await uploadPromise;

//   const expirationTime = parseInt(process.env.EXPIRATION_TIME, 10) || 600000;
//   const expirationDate = new Date(Date.now() + expirationTime);

//   const metadata = new File({
//     storageKey: fileinfo.storageKey,
//     originalName: fileinfo.originalName,
//     mimeType: fileinfo.mimeType,
//     size: fileinfo.size,
//     expirationDate,
//   });
//   await metadata.save();

//   console.log(`✅ Upload: ${fileinfo.originalName} (${fileinfo.size} bytes) in ${Date.now() - startTime}ms`);
//   res.status(201).json(new APIResponse(201, { fileId: metadata._id }, 'Uploaded'));
// });

// ============ TRUE STREAMING UPLOAD (raw binary) ============
export const uploadStream = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const filename = decodeURIComponent(req.headers['x-filename'] || 'unnamed');
  const originalSize = parseInt(req.headers['x-original-size'] || '0', 10);
  const mimeType = req.headers['x-content-type'] || 'application/octet-stream';

  console.log('📥 Upload headers:', {
    'x-filename': req.headers['x-filename'],
    'x-original-size': req.headers['x-original-size'],
    'x-content-type': req.headers['x-content-type'],
  });
  console.log('📊 Parsed originalSize:', originalSize);

  if (!filename) throw new APIError(400, 'X-Filename header required');
  if (originalSize === 0) throw new APIError(400, 'X-Original-Size header required or non‑zero');

  const key = `${Date.now()}-${randomUUID()}-${filename}`;
  console.log(`🔑 Generated key: ${key}`);

  let encryptedSize = 0;

  // ---- STEP 1: Upload to B2 ----
  try {
    console.log('⏳ Starting B2 upload stream...');
    const { pass, uploadPromise } = uploadStreamToS3(key, mimeType, 1024 * 1024 * 2);

    console.log('⏳ Piping request to B2...');
    await pipelineAsync(req, pass);
    console.log('✅ Pipeline finished, waiting for B2 upload to complete...');

    console.log('⏳ Waiting for uploadPromise...');
    await uploadPromise;
    console.log('✅ B2 upload complete (multipart finalized)');

  } catch (err) {
    console.error('❌ Upload to B2 failed at step:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    if (err.$metadata) {
      console.error('Request ID:', err.$metadata.requestId);
      console.error('HTTP Status:', err.$metadata.httpStatusCode);
    }
    throw new APIError(500, 'Upload to B2 failed: ' + err.message);
  }

  // ---- STEP 2: Get metadata from B2 ----
  try {
    console.log('⏳ Fetching S3 metadata for key:', key);
    // const head = await getObjectMetadata(key);
    encryptedSize = parseInt(req.headers['x-encrypted-size'] || '0', 10);
    if (!encryptedSize) {
        // fallback: compute it
        const TAG_SIZE = 16;
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const numChunks = Math.ceil(originalSize / CHUNK_SIZE);
        encryptedSize = originalSize + numChunks * TAG_SIZE;
    }
    console.log(`📦 Encrypted size: ${encryptedSize} bytes (estimated)`);
    // encryptedSize = head.ContentLength || 0;
    // console.log(`✅ B2 metadata fetched: ContentLength=${encryptedSize}, ContentType=${head.ContentType}`);
  } catch (err) {
    console.error('❌ Failed to get B2 metadata:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    throw new APIError(500, 'Failed to get B2 metadata: ' + err.message);
  }

  // ---- STEP 3: Save metadata to MongoDB ----
  try {
    const expirationTime = parseInt(process.env.EXPIRATION_TIME, 10) || 600000;
    const expirationDate = new Date(Date.now() + expirationTime);

    const metadataData = {
      storageKey: key,
      originalName: filename,
      mimeType,
      size: encryptedSize,
      originalSize: originalSize,
      expirationDate,
    };
    console.log('💾 Creating metadata:', metadataData);

    console.log('⏳ Saving metadata to MongoDB...');
    const metadata = new File(metadataData);
    await metadata.save();
    console.log('✅ Metadata saved successfully:', metadata._id);

    console.log(`✅ Upload: ${filename} (${encryptedSize} bytes) in ${Date.now() - startTime}ms`);

    // ---- STEP 4: Send response ----
    console.log('⏳ Sending success response...');
    res.status(201).json(new APIResponse(201, { fileId: metadata._id }, 'Streaming upload complete'));
    console.log('✅ Response sent successfully');

  } catch (err) {
    console.error('❌ Metadata save or response error:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    // The file is already in B2, but we couldn't save metadata.
    // You may want to delete the B2 file to avoid orphans.
    // For now, just throw.
    throw new APIError(500, 'Failed to save metadata: ' + err.message);
  }
});