import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LbcWorkflowWorkbench from './LbcWorkflowWorkbench.tsx';
import GenericProcessMathApp from './GenericProcessMathApp.tsx';
import ProcessSimulationApp from './ProcessSimulationApp.tsx';
import ProcessRiskApp from './ProcessRiskApp.tsx';
import ProcessBatchApp from './ProcessBatchApp.tsx';
import NativeProcessMathOverlay from './NativeProcessMathOverlay.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

const params = new URLSearchParams(window.location.search);
const view = params.get('view');
const showLbcWorkflowAtlas = view === 'lbc' || window.location.hash === '#lbc';
const showProcessMathWorkbench = view === 'process-math' || window.location.hash === '#process-math';
const showProcessSimulation = view === 'process-sim' || window.location.hash === '#process-sim';
const showProcessRisk = view === 'process-risk' || window.location.hash === '#process-risk';
const showProcessBatch = view === 'process-batch' || window.location.hash === '#process-batch';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {showProcessBatch ? (
        <ProcessBatchApp />
      ) : showProcessRisk ? (
        <ProcessRiskApp />
      ) : showProcessSimulation ? (
        <ProcessSimulationApp />
      ) : showProcessMathWorkbench ? (
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
