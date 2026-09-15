import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import './styles/global.css';
import './styles/tokens.css';
import './styles/components.css';
import './styles/pages.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing');
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
