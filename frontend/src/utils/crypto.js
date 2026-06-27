export const CHUNK_SIZE = 2 * 1024 * 1024; 

function deriveIV(baseIV, counter) {
  const iv = new Uint8Array(baseIV);
  const counterBytes = new Uint8Array(4);
  new DataView(counterBytes.buffer).setUint32(0, counter);
  for (let i = 0; i < 4; i++) {
    iv[12 - 4 + i] ^= counterBytes[i];
  }
  return iv;
}

export const generateKeyAndIV = async () => {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { key, iv };
};

export const exportKey = async (key) => {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
};

export const importKey = async (base64Key) => {
  const raw = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
};

/* ==========================================
   ZERO‑BLOAT ENCRYPTION STREAM (UPLOAD)
   ========================================== */
export const encryptFileStream = (file, key, iv) => {
  let offset = 0;
  let counter = 0;

  return new ReadableStream({
    async pull(controller) {
      if (offset >= file.size) {
        controller.close();
        return;
      }
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buf = await slice.arrayBuffer();
      const chunkIV = deriveIV(iv, counter);
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: chunkIV },
        key,
        buf
      );
      controller.enqueue(new Uint8Array(encryptedBuffer));
      offset += CHUNK_SIZE;
      counter++;
    },
  });
};

/* ==========================================
   NATIVE TRANSFORM DECRYPTION (DOWNLOAD)
   ========================================== */
import { decryptChunksParallel } from './cryptoWorker.js';

export const decryptStream = async (encryptedStream, key, iv, plaintextSize, onProgress) => {
  const TAG_SIZE = 16;
  const EXPECTED_CHUNK_SIZE = CHUNK_SIZE + TAG_SIZE;

  let buffer = new Uint8Array(0);
  let counter = 0;
  let bytesDecrypted = 0;

  const transform = new TransformStream({
    async transform(chunk, controller) {
      // Append new data to buffer
      const combined = new Uint8Array(buffer.length + chunk.length);
      combined.set(buffer);
      combined.set(chunk, buffer.length);
      buffer = combined;

      const fullChunks = [];
      while (buffer.length >= EXPECTED_CHUNK_SIZE) {
        fullChunks.push(buffer.subarray(0, EXPECTED_CHUNK_SIZE));
        buffer = buffer.subarray(EXPECTED_CHUNK_SIZE);
      }

      if (fullChunks.length) {
        const decrypted = await decryptChunksParallel(key, iv, fullChunks, counter);
        counter += fullChunks.length;
for (const { decrypted: dec } of decrypted) {
            bytesDecrypted += dec.length;
            if (onProgress && plaintextSize > 0) {
              onProgress(Math.min(100, Math.round((bytesDecrypted / plaintextSize) * 100)));
            }
            controller.enqueue(dec);
          }
      }
    },
    async flush(controller) {
      if (buffer.length) {
        const decrypted = await decryptChunksParallel(key, iv, [buffer], counter);
        const dec = decrypted[0].decrypted;
        bytesDecrypted += dec.length;
        if (onProgress && plaintextSize > 0) {
          onProgress(Math.min(100, Math.round((bytesDecrypted / plaintextSize) * 100)));
        }
        controller.enqueue(dec);
      }
    },
  });

  return encryptedStream.pipeThrough(transform);
};
