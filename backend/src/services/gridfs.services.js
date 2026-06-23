import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { File } from '../models/fileMetadata.models.js';
import { deleteObject } from '../services/b2.services.js';

let bucket;

const connectToGridFS = () => {
    const db = mongoose.connection.db;
    bucket = new GridFSBucket(db, { bucketName: 'uploads' });
    return bucket;
};

const getBucket = () => {
    if (!bucket) throw new Error('GridFS not initialized');
    return bucket;
};

const cleanupExpiredFiles = async () => {
    try {
        const now = new Date();
        const expired = await File.find({ expirationDate: { $lt: now } });

        for (const file of expired) {
            try {
                // 1️⃣ Delete from B2
                await deleteObject(file.storageKey);
                console.log(`🗑️ Deleted from B2: ${file.storageKey}`);

                // 2️⃣ Delete metadata from MongoDB
                await file.deleteOne();
                console.log(`🗑️ Deleted metadata for: ${file.originalName}`);
            } catch (err) {
                console.error(`❌ Failed to delete file ${file.storageKey}:`, err.message);
                // You may want to retry or log for manual cleanup
            }
        }
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
};

export { connectToGridFS, getBucket, cleanupExpiredFiles };