import { APIError } from "../utils/APIError.js";
import { APIResponse } from "../utils/APIResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import busboy from "busboy";
import { randomUUID } from 'crypto';
import { uploadStreamToB2, getObjectMetadata } from '../services/b2.services.js';
import { File } from '../models/fileMetadata.models.js';

export const uploadFile = asyncHandler(async (req, res) => {
    const bb = busboy({ headers: req.headers });

    let uploadStream;
    let fileinfo = {};
    let fileFound = false;

    const uploadPromise = new Promise((resolve, reject) => {
        bb.on("file", (fieldname, stream, fileInfo) => {
            fileFound = true;
            
            // Extract metadata from busboy
            fileinfo.originalName = fileInfo.filename;
            fileinfo.mimeType = fileInfo.mimeType || 'application/octet-stream';
            
            // Generate unique key for B2
            const key = `${Date.now()}-${randomUUID()}-${fileInfo.filename}`;
            fileinfo.storageKey = key;

            // Start B2 upload stream
            const { pass, uploadPromise } = uploadStreamToB2(key, fileinfo.mimeType);
            
            // Pipe the file stream to B2 via PassThrough
            stream.pipe(pass)
                .on('error', reject)
                .on('finish', async () => {
                    try {
                        // Wait for B2 upload to complete
                        await uploadPromise;
                        
                        // Get file size from B2 metadata
                        const head = await getObjectMetadata(key);
                        fileinfo.size = head.ContentLength || 0;
                        
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
        });

        bb.on('finish', () => {
            if (!fileFound) {
                reject(new Error('No file uploaded'));
            }
        });

        bb.on('error', reject);
    });

    req.pipe(bb);
    await uploadPromise;

    // Calculate expiration (default 1 hour)
    const expirationTime = parseInt(process.env.EXPIRATION_TIME, 10) || 600000;
    const expirationDate = new Date(Date.now() + expirationTime);

    // Save metadata to MongoDB (only metadata, file is in B2)
    const metadata = new File({
        storageKey: fileinfo.storageKey,
        originalName: fileinfo.originalName,
        mimeType: fileinfo.mimeType,
        size: fileinfo.size,
        expirationDate,
    });
    await metadata.save();

    res.status(201).json(
        new APIResponse(
            201,
            { fileId: metadata._id },
            'File uploaded successfully to Backblaze B2'
        )
    );
});