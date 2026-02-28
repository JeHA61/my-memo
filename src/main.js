import * as React from 'react';
import { createRoot } from 'react-dom/client';
import LegacyApp from './components/LegacyApp.js';

const root = document.getElementById('root');
createRoot(root).render(React.createElement(LegacyApp));
