import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LearnEnglish from './pages/LearnEnglish';

function App() {
  return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/learn-english" replace />} />
            <Route path="learn-english" element={<LearnEnglish />} />
          </Route>
        </Routes>
      </BrowserRouter>
  );
}

export default App;
