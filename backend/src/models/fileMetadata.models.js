import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  storageKey: { type: String, required: true }, // B2 object key
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  originalSize: { type: Number, required: true }, // Original size before encryption
  uploadDate: { type: Date, default: Date.now },
  expirationDate: { type: Date, required: true },
  // optional: track if file has been downloaded
  downloaded: { type: Boolean, default: false },
});

export const File = mongoose.model('FileMetadata', fileSchema);