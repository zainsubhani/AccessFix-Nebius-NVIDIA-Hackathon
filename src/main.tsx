import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import App from './App';
import FirstStep from './firststep/FirstStep';
import './styles.css';

const Page = location.pathname === '/firststep' || location.pathname.startsWith('/firststep/') ? FirstStep : App;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Page /></React.StrictMode>);
