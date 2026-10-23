import React from 'react';
import { createRoot } from 'react-dom/client';
import Entry from './ui/Entry';
import './ui/styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Entry /></React.StrictMode>);
