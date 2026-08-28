import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LbcWorkflowWorkbench from './LbcWorkflowWorkbench.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

const params = new URLSearchParams(window.location.search);
const showLbcWorkflowAtlas = params.get('view') === 'lbc' || window.location.hash === '#lbc';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {showLbcWorkflowAtlas ? <LbcWorkflowWorkbench /> : <App />}
    </ThemeProvider>
  </StrictMode>,
);
