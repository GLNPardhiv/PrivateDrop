// const CHUNK_SIZE = 1024 * 1024;

// Cache the imported key so we only do it once per file transfer
let cachedKey = null;
let cachedKeyUsage = null;

function deriveIV(baseIV, counter) {
  const iv = new Uint8Array(baseIV);
  const counterBytes = new Uint8Array(4);
  new DataView(counterBytes.buffer).setUint32(0, counter);
  for (let i = 0; i < 4; i++) {
    iv[12 - 4 + i] ^= counterBytes[i];
  }
  return iv;
}

self.onmessage = async (e) => {
  const { type, payload, id } = e.data;
  try {
    let result;
    let transferables = [];

    if (type === 'ENCRYPT_CHUNKS' || type === 'DECRYPT_CHUNKS') {
      const { rawKey, baseIV, chunks, startCounter } = payload;
      const usage = type === 'ENCRYPT_CHUNKS' ? 'encrypt' : 'decrypt';

      // Import the key ONLY if it hasn't been cached or if the usage changed
      if (!cachedKey || cachedKeyUsage !== usage) {
        cachedKey = await crypto.subtle.importKey(
          'raw',
          rawKey,
          { name: 'AES-GCM' },
          false,
          [usage]
        );
        cachedKeyUsage = usage;
      }

      const results = await Promise.all(
        chunks.map(async (chunk, index) => {
          const counter = startCounter + index;
          const iv = deriveIV(baseIV, counter);
          const processedBuffer = await crypto.subtle[usage](
            { name: 'AES-GCM', iv },
            cachedKey,
            chunk
          );
          return {
            counter,
            [usage === 'encrypt' ? 'encrypted' : 'decrypted']: new Uint8Array(processedBuffer),
          };
        })
      );

      result = { chunks: results };
      transferables = results.map(r =>
        r.encrypted ? r.encrypted.buffer : r.decrypted.buffer
      );
    } else if (type === 'RESET_KEY') {
      cachedKey = null;
      cachedKeyUsage = null;
      result = { success: true };
    } else {
      throw new Error('Unknown type: ' + type);
    }

    // Transfer ownership of the buffers back to main thread.
    self.postMessage({ id, result }, transferables);
  } catch (err) {
    self.postMessage({ id, error: err.message });
  }
};
