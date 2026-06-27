import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dropzone from './components/Dropzone';
import DownloadPage from './components/DownloadPage';

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Dropzone />} />
      <Route path="/download/:fileId" element={<DownloadPage />} />
    </Routes>
  </BrowserRouter>
);

export default App;