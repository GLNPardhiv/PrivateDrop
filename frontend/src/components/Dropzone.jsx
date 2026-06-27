import React, { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFileStream } from '../api/fileService';
import { generateKeyAndIV, exportKey, encryptFileStream } from '../utils/crypto';

const HowItWorksItem = ({ step, title, description }) => (
  <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-7 hover:bg-slate-800/60 hover:border-cyan-500/40 transition-all duration-300 group shadow-lg shadow-black/20">
    <div className="w-14 h-14 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 group-hover:bg-cyan-500/20 group-hover:border-cyan-500/30 transition-colors">
      <span className="text-2xl font-bold text-cyan-400">{step}</span>
    </div>
    <h4 className="text-xl font-semibold text-white mb-3 group-hover:text-cyan-300 transition-colors">{title}</h4>
    <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
  </div>
);

const UnderTheHoodItem = ({ title, description, icon }) => (
  <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-8 hover:bg-slate-800/60 hover:border-cyan-500/40 transition-all duration-300 shadow-lg shadow-black/20">
    <div className="text-4xl mb-4">{icon}</div>
    <h4 className="text-lg font-semibold text-cyan-400 mb-3">{title}</h4>
    <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
  </div>
);

const Dropzone = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  const howItWorksRef = useRef(null);
  const underTheHoodRef = useRef(null);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      setFile(accepted[0]);
      setLink('');
      setCopied(false);
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const { key, iv } = await generateKeyAndIV();
      const keyBase64 = await exportKey(key);
      const ivBase64 = btoa(String.fromCharCode(...iv));

      const encryptedStream = encryptFileStream(file, key, iv);
      const { fileId } = await uploadFileStream(
        encryptedStream,
        file.name,
        file.size,
        setProgress
      );

      const url = `${window.location.origin}/download/${fileId}#key=${encodeURIComponent(keyBase64)}&iv=${encodeURIComponent(ivBase64)}`;
      setLink(url);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 font-sans selection:bg-cyan-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/50 shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104a5.25 5.25 0 0110.5 0v4.006c0 .554-.385 1.032-.972 1.195A26.96 26.96 0 0110.5 10.5v8.5m3-.001h-3v3h3v-3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">PrivateDrop</h1>
          </div>
          
          <nav className="hidden sm:flex items-center gap-1">
            <button onClick={() => scrollToSection(howItWorksRef)} className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all duration-200">
              How it Works
            </button>
            <button onClick={() => scrollToSection(underTheHoodRef)} className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all duration-200">
              Security
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero / Upload Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/20 via-slate-900/80 to-slate-900" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px] -translate-y-1/2 pointer-events-none" />
          
          <div className="relative max-w-2xl mx-auto px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
            <div className="text-center mb-12">
              <h2 className="text-4xl sm:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                Send files <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  without compromise.
                </span>
              </h2>
              <p className="text-lg sm:text-xl text-slate-400 max-w-lg mx-auto leading-relaxed">
                End-to-end encrypted sharing. Your data stays yours—no servers, no tracking, no logs.
              </p>
            </div>

            {/* Upload Card */}
            <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-8 sm:p-10 shadow-2xl shadow-black/30">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">Upload Your File</h3>
                <p className="text-slate-400">
                  Encrypted in your browser. The key never touches the server.
                </p>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-12 sm:p-16 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                    : 'border-slate-600 hover:border-cyan-500/50 hover:bg-slate-800/50'
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div>
                    <p className="text-lg font-medium text-white">{file.name}</p>
                    <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 mb-5 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg shadow-black/20">
                      <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <p className="text-base text-slate-200 font-medium mb-1">
                      {isDragActive ? 'Drop it here...' : 'Drag & drop, or click to select'}
                    </p>
                    <p className="text-xs text-slate-500">Up to 100MB. Encrypted instantly.</p>
                  </div>
                )}
              </div>

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full mt-8 py-4 rounded-2xl font-bold text-white text-base transition-all duration-300 ${
                  !file || uploading
                    ? 'bg-slate-700 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/40 hover:scale-[1.02]'
                }`}
              >
                {uploading ? 'Encrypting & Uploading...' : 'Upload & Get Secure Link'}
              </button>

              {uploading && (
                <div className="mt-8">
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-cyan-400 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2">
                    <p className="text-xs text-slate-500 font-medium">Encrypting...</p>
                    <p className="text-xs text-slate-400 font-mono">{progress}%</p>
                  </div>
                </div>
              )}

              {link && (
                <div className="mt-8 p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                  <p className="font-bold text-emerald-400 text-sm mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    File uploaded successfully
                  </p>
                  <div className="bg-slate-900/80 rounded-xl p-4 break-all text-sm text-cyan-300 font-mono border border-slate-800/50 shadow-inner">
                    {link}
                  </div>
                  <button
                    onClick={handleCopy}
                    className={`mt-4 w-full py-3 rounded-xl text-sm font-bold text-white transition-all ${
                      copied
                        ? 'bg-emerald-600 shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy Link to Clipboard'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

         {/* How It Works Section */}
        <section ref={howItWorksRef} className="relative py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="text-center mb-20">
              <p className="text-cyan-400 text-xs font-bold tracking-[0.2em] uppercase mb-4">Process</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6">How It Works</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg sm:text-xl leading-relaxed">
                Three simple steps to secure, encrypted file sharing.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <HowItWorksItem
                step="01"
                title="Select File"
                description="Drag and drop or browse to upload any file. We instantly prepare your data for secure transfer."
              />
              <HowItWorksItem
                step="02"
                title="Encrypt & Upload"
                description="Your file is encrypted with AES-256 in your browser using a random key. The key stays with you."
              />
              <HowItWorksItem
                step="03"
                title="Share Link"
                description="A secure link is generated. Only those with the link can access and decrypt the file."
              />
            </div>
          </div>
        </section>

        {/* Under the Hood Section */}
        <section ref={underTheHoodRef} className="relative bg-slate-950 py-24 sm:py-32 border-y border-slate-800/50">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/10 via-slate-950 to-slate-950 pointer-events-none" />
          <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="flex flex-col lg:flex-row gap-16">
              <div className="lg:w-1/3 lg:sticky lg:top-32 lg:self-start">
                <p className="text-cyan-400 text-xs font-bold tracking-[0.2em] uppercase mb-4">Security</p>
                <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-8 leading-tight">
                  Under The <span className="text-cyan-400">Hood</span>
                </h2>
                <p className="text-slate-400 text-lg leading-relaxed">
                  We use industry-standard encryption and best-in-class security practices to guarantee the privacy of your files.
                </p>
              </div>
              <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <UnderTheHoodItem
                   icon="🔐"
                  title="AES-256 Encryption"
                  description="A symmetric encryption standard used by the U.S. government to protect top-secret documents, virtually unbreakable with current computing technology."
                />
                <UnderTheHoodItem
                   icon="🚫"
                  title="No Storage of Keys"
                  description="Our servers never see your encryption key. It's generated in your browser and only exists in your secure sharing link. We cannot decrypt your files."
                />
                <UnderTheHoodItem
                   icon="☁️"
                  title="Ephemeral Storage"
                  description="Encrypted files are automatically and permanently deleted from servers after a certain period, leaving no data trace behind."
                />
                <UnderTheHoodItem
                   icon="🌐"
                  title="Client-Side Crypto"
                  description="All encryption and decryption happens directly in your web browser, ensuring your data is unreadable during transit and server storage."
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104a5.25 5.25 0 0110.5 0v4.006c0 .554-.385 1.032-.972 1.195A26.96 26.96 0 0110.5 10.5v8.5m3-.001h-3v3h3v-3z" />
              </svg>
            </div>
            <span className="text-base font-semibold text-white">PrivateDrop</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors">About</a>
            <a href="#" className="text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors">Privacy</a>
          </div>
        </div>
        
        <div className="border-t border-slate-800/50 py-6">
          <p className="text-center text-sm text-slate-600">
            © {new Date().getFullYear()} PrivateDrop. End-to-end encrypted.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Dropzone;