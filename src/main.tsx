import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LbcWorkflowWorkbench from './LbcWorkflowWorkbench.tsx';
import GenericProcessMathApp from './GenericProcessMathApp.tsx';
import UniversalProcessMathApp from './UniversalProcessMathApp.tsx';
import ProcessSimulationApp from './ProcessSimulationApp.tsx';
import UniversalProcessSimulationApp from './UniversalProcessSimulationApp.tsx';
import ProcessRiskApp from './ProcessRiskApp.tsx';
import ProcessBatchApp from './ProcessBatchApp.tsx';
import ProcessBatchRiskApp from './ProcessBatchRiskApp.tsx';
import ProcessDigitalTwinApp from './ProcessDigitalTwinApp.tsx';
import ProcessReliabilityApp from './ProcessReliabilityApp.tsx';
import ProcessUnifiedTwinApp from './ProcessUnifiedTwinApp.tsx';
import ProcessUnifiedOptimizerApp from './ProcessUnifiedOptimizerApp.tsx';
import UniversalProcessLabApp from './UniversalProcessLabApp.tsx';
import NativeProcessMathOverlay from './NativeProcessMathOverlay.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import './index.css';

const params = new URLSearchParams(window.location.search);
const view = params.get('view');
const showLbcWorkflowAtlas = view === 'lbc' || window.location.hash === '#lbc';
const showProcessMathWorkbench = view === 'process-math' || window.location.hash === '#process-math';
const showLegacyProcessMathWorkbench = view === 'process-math-legacy' || window.location.hash === '#process-math-legacy';
const showProcessSimulation = view === 'process-sim' || window.location.hash === '#process-sim';
const showLegacyProcessSimulation = view === 'process-sim-legacy' || window.location.hash === '#process-sim-legacy';
const showProcessRisk = view === 'process-risk' || window.location.hash === '#process-risk';
const showProcessBatch = view === 'process-batch' || window.location.hash === '#process-batch';
const showProcessBatchRisk = view === 'process-batch-risk' || window.location.hash === '#process-batch-risk';
const showProcessDigitalTwin = view === 'process-digital-twin' || window.location.hash === '#process-digital-twin';
const showProcessReliability = view === 'process-reliability' || window.location.hash === '#process-reliability';
const showProcessUnifiedTwin = view === 'process-unified-twin' || window.location.hash === '#process-unified-twin';
const showProcessUnifiedOptimizer = view === 'process-unified-opt' || window.location.hash === '#process-unified-opt';
const showUniversalProcessLab = view === 'process-universal' || window.location.hash === '#process-universal';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {showUniversalProcessLab ? (
        <UniversalProcessLabApp />
      ) : showProcessUnifiedOptimizer ? (
        <ProcessUnifiedOptimizerApp />
      ) : showProcessUnifiedTwin ? (
        <ProcessUnifiedTwinApp />
      ) : showProcessReliability ? (
        <ProcessReliabilityApp />
      ) : showProcessDigitalTwin ? (
        <ProcessDigitalTwinApp />
      ) : showProcessBatchRisk ? (
        <ProcessBatchRiskApp />
      ) : showProcessBatch ? (
        <ProcessBatchApp />
      ) : showProcessRisk ? (
        <ProcessRiskApp />
      ) : showLegacyProcessSimulation ? (
        <ProcessSimulationApp />
      ) : showProcessSimulation ? (
        <UniversalProcessSimulationApp />
      ) : showLegacyProcessMathWorkbench ? (
        <GenericProcessMathApp />
      ) : showProcessMathWorkbench ? (
        <UniversalProcessMathApp />
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
