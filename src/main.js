import * as React from 'react';
import { createRoot } from 'react-dom/client';
import LegacyApp from './components/LegacyApp.js';

window.__BLACKSPACE_MODULE_BOOT__ = true;

const root = document.getElementById('root');
createRoot(root).render(React.createElement(LegacyApp));
