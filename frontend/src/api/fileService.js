const API_BASE = '/api/v1/files';
const STREAM_BASE = '/api/v1/users';

export const getFileInfo = async (fileId) => {
  const res = await fetch(`${API_BASE}/info/${fileId}`);
  if (!res.ok) throw new Error('File not found or expired');
  const json = await res.json();
  return json.data;
};

export const downloadFileStream = async (fileId, signal) => {
  const response = await fetch(`${API_BASE}/download/${fileId}`, {
    signal,
    headers: { 'Accept-Encoding': 'identity' },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Download failed (${response.status})`);
  }
  if (!response.body) {
    throw new Error('No response body');
  }
  return { response };
};

export const uploadFileStream = async (encryptedStream, fileName, fileSize, onProgress, signal) => {
  const TAG_SIZE = 16;
  const CHUNK_SIZE = 1024 * 1024;
  const numChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const estimatedEncryptedSize = fileSize + numChunks * TAG_SIZE;

  let bytesUploaded = 0;
  const progressStream = new TransformStream({
    transform(chunk, controller) {
      bytesUploaded += chunk.byteLength;
      const progress = Math.min(99, Math.round((bytesUploaded / estimatedEncryptedSize) * 100));
      onProgress(progress);
      controller.enqueue(chunk);
    },
  });

  const pipedStream = encryptedStream.pipeThrough(progressStream);

  // Collect stream into chunks then upload as blob (reliable approach)
  const reader = pipedStream.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const blob = new Blob(chunks, { type: 'application/octet-stream' });

  const response = await fetch(`${STREAM_BASE}/upload/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': encodeURIComponent(fileName),
      'X-Original-Size': fileSize.toString(),
      'X-Encrypted-Size': estimatedEncryptedSize.toString(),
    },
    body: blob,
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload failed: ${errText}`);
  }

  const result = await response.json();
  onProgress(100);
  return result.data;
};