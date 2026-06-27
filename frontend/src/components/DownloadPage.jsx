import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getFileInfo, downloadFileStream } from '../api/fileService';
import { importKey, decryptStream } from '../utils/crypto';
// import { resetDecryptKeyCache } from '../utils/cryptoWorker';

const DownloadPage = () => {
  const { fileId } = useParams();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [progress, setProgress] = useState(0);

const updateProgress = (() => {
  let last = 0;
  let timer = null;
  return (value) => {
    if (value === last) return;
    last = value;
    if (timer) return;
    timer = setTimeout(() => {
      setProgress(value);
      timer = null;
    }, 200);
  };
})();

  useEffect(() => {
    (async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.substring(1));
        const keyBase64 = hash.get('key');
        const ivBase64 = hash.get('iv');
        if (!keyBase64 || !ivBase64) throw new Error('Missing decryption key/IV');

        const key = await importKey(decodeURIComponent(keyBase64));
        const iv = Uint8Array.from(atob(decodeURIComponent(ivBase64)), c => c.charCodeAt(0));

        const fileInfo = await getFileInfo(fileId);
        setInfo({ ...fileInfo, key, iv });
        setStatus('ready');
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    })();
  }, [fileId]);

  const startDownload = async () => {
    if (!info) return;
    setStatus('downloading');
    setProgress(0);
    try {
      const { response } = await downloadFileStream(fileId);
    // Clone the response so the body stream is not locked elsewhere
    const encryptedStream = response.clone().body;
      const hasFilePicker = 'showSaveFilePicker' in window;

      if (hasFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: info.originalName,
            types: [{
              description: 'File',
              accept: { [info.mimeType || 'application/octet-stream']: ['.' + (info.originalName.split('.').pop() || 'bin')] },
            }],
          });

          const writable = await handle.createWritable();
const decryptedStream = await decryptStream(encryptedStream, info.key, info.iv, info.originalSize, updateProgress);
          const reader = decryptedStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writable.write(value);
          }
          await writable.close();
          setStatus('complete');
          return;
        } catch (pickerErr) {
          if (pickerErr.name === 'NotAllowedError' || pickerErr.name === 'AbortError') {
            setStatus('error');
            setError('Download cancelled or permission denied');
            return;
          }
        }
      }

      // OPTIMIZATION: Direct pipe reading from response.body instead of duplicate clone copies
      const decryptedStream = await decryptStream(encryptedStream, info.key, info.iv, info.originalSize, updateProgress);
      const chunks = [];
      const reader = decryptedStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const blob = new Blob(chunks, { type: info.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = info.originalName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus('complete');
    //   resetDecryptKeyCache(); // Clear cached keys after download
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 rounded-full border-4 border-cyan-400/30 border-t-cyan-400 animate-spin" />
        <p className="mt-4 text-sm text-slate-400">Loading secure file information...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-10 shadow-2xl shadow-black/30 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.648 3.374h14.71c1.43 0 2.513-1.874 1.648-3.374L13.249 4.228c-.94-1.629-3.288-1.629-4.202 0L2.697 15.848z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Download Failed</h2>
          <p className="text-slate-400 mb-8">{error}</p>
          <Link to="/" className="inline-block py-2.5 px-6 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold text-white transition-all duration-200">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-2">Secure File</h2>
            <p className="text-slate-400">Ready for download and decryption.</p>
          </div>

          <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-8 shadow-2xl shadow-black/30 text-center">
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-cyan-500/10">
              <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 9.776c0 4.754 1.693 8.245 5.71 8.245 1.97 0 3.41-1.036 4.055-2.263M13.198 4.005c.234 6.394-.245 14.354-.245 14.354s-3.924-6.868-7.733-4.113M3.53 14.333c0-4.756 2.427-7.713 7.634-7.713 1.815 0 3.761.253 5.575.253M17.403 4.219c2.46 0 4.56 2.024 4.56 4.593 0 2.668-1.99 4.802-4.56 4.802-2.694 0-4.704-2.134-4.704-4.802 0-2.569 1.825-4.593 4.704-4.593z" />
              </svg>
            </div>

            <h3 className="text-xl font-bold text-white mb-1 truncate px-4">{info.originalName}</h3>
            <p className="text-slate-500 text-sm mb-8">{(info.originalSize / 1024 / 1024).toFixed(2)} MB</p>

            <button
              onClick={startDownload}
              className="w-full py-4 rounded-2xl font-bold text-white text-base bg-cyan-600 hover:bg-cyan-500 shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all duration-300"
            >
              Download & Decrypt
            </button>
            <Link to="/" className="mt-4 block text-sm text-slate-500 hover:text-cyan-400 transition-colors">
              Upload another file
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'downloading') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full border-4 border-slate-700 border-t-cyan-400 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">Downloading...</h2>
          <p className="text-slate-400 mb-6">Decrypting the file stream on your device.</p>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
            <div
              className="bg-cyan-400 h-2.5 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2 font-mono">{progress}%</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-3xl p-10 shadow-2xl shadow-black/30 max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Download Complete</h2>
        <p className="text-slate-400 mb-8">Your file is decrypted and ready.</p>
        <Link to="/" className="block w-full py-3 rounded-xl text-sm font-bold text-white bg-slate-700 hover:bg-slate-600 transition-all duration-200">
          Upload another file
        </Link>
      </div>
    </div>
  );
};

export default DownloadPage;