import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LbcWorkflowWorkbench from './LbcWorkflowWorkbench.tsx';
import GenericProcessMathApp from './GenericProcessMathApp.tsx';
import NativeProcessMathOverlay from './NativeProcessMathOverlay.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

const params = new URLSearchParams(window.location.search);
const view = params.get('view');
const showLbcWorkflowAtlas = view === 'lbc' || window.location.hash === '#lbc';
const showProcessMathWorkbench = view === 'process-math' || window.location.hash === '#process-math';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {showProcessMathWorkbench ? (
        <GenericProcessMathApp />
      ) : showLbcWorkflowAtlas ? (
        <LbcWorkflowWorkbench />
      ) : (
        <>
          <App />
          <NativeProcessMathOverlay />
        </>
      )}
    </ThemeProvider>
  </StrictMode>,
);
