let worker = null;
let messageId = 0;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./crypto.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, result, error } = e.data;
      if (pending.has(id)) {
        const { resolve, reject } = pending.get(id);
        pending.delete(id);
        if (error) reject(new Error(error));
        else resolve(result);
      }
    };
    worker.onerror = (err) => {
      console.error('Worker error:', err);
    };
  }
  return worker;
}

function sendMessage(type, payload, transferables = []) {
  return new Promise((resolve, reject) => {
    const id = messageId++;
    pending.set(id, { resolve, reject });
    const worker = getWorker();
    worker.postMessage({ type, payload, id }, transferables);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('Worker timeout'));
      }
    }, 120000);
  });
}

/**
 * Encrypt an array of Uint8Array chunks in parallel using a Web Worker.
 * Returns an array of encrypted Uint8Array chunks (same order).
 */
export async function encryptChunksParallel(key, baseIV, chunks, startCounter) {
  const rawKey = key instanceof CryptoKey ? new Uint8Array(await crypto.subtle.exportKey('raw', key)) : key;
  // Transfer without using transferables to avoid detaching shared buffers
  const result = await sendMessage('ENCRYPT_CHUNKS', { rawKey, baseIV, chunks, startCounter });
  return result.chunks;
}

/**
 * Decrypt an array of encrypted Uint8Array chunks in parallel using a Web Worker.
 * Returns an array of decrypted Uint8Array chunks (same order).
 */
export async function decryptChunksParallel(key, baseIV, chunks, startCounter) {
  const rawKey = key instanceof CryptoKey ? new Uint8Array(await crypto.subtle.exportKey('raw', key)) : key;
  // Transfer without using transferables to avoid detaching shared buffers
  const result = await sendMessage('DECRYPT_CHUNKS', { rawKey, baseIV, chunks, startCounter });
  return result.chunks;
}

/**
 * Reset the worker's cached CryptoKey (useful after a download completes).
 */
export function resetDecryptKeyCache() {
  const worker = getWorker();
  worker.postMessage({ type: 'RESET_KEY', payload: {}, id: messageId++ });
}
