import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './components/xp-skin.css';
import { LayoutOutput } from './components/layout-studio';
createRoot(document.getElementById('root')).render(<React.StrictMode>{new URLSearchParams(location.search).has('layout-output')?<LayoutOutput/>:<App />}</React.StrictMode>);
