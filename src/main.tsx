import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LbcWorkflowWorkbench from './LbcWorkflowWorkbench.tsx';
import GenericProcessMathApp from './GenericProcessMathApp.tsx';
import UniversalProcessMathApp from './UniversalProcessMathApp.tsx';
import ProcessSimulationApp from './ProcessSimulationApp.tsx';
import UniversalProcessSimulationApp from './UniversalProcessSimulationApp.tsx';
import ProcessRiskApp from './ProcessRiskApp.tsx';
import UniversalProcessRiskApp from './UniversalProcessRiskApp.tsx';
import ProcessBatchApp from './ProcessBatchApp.tsx';
import ProcessBatchRiskApp from './ProcessBatchRiskApp.tsx';
import UniversalProcessBatchApp from './UniversalProcessBatchApp.tsx';
import ProcessDigitalTwinApp from './ProcessDigitalTwinApp.tsx';
import UniversalProcessDigitalTwinApp from './UniversalProcessDigitalTwinApp.tsx';
import ProcessReliabilityApp from './ProcessReliabilityApp.tsx';
import UniversalProcessReliabilityApp from './UniversalProcessReliabilityApp.tsx';
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
const showLegacyProcessRisk = view === 'process-risk-legacy' || window.location.hash === '#process-risk-legacy';
const showProcessBatch = view === 'process-batch' || window.location.hash === '#process-batch';
const showProcessBatchRisk = view === 'process-batch-risk' || window.location.hash === '#process-batch-risk';
const showLegacyProcessBatch = view === 'process-batch-legacy' || window.location.hash === '#process-batch-legacy';
const showLegacyProcessBatchRisk = view === 'process-batch-risk-legacy' || window.location.hash === '#process-batch-risk-legacy';
const showProcessDigitalTwin = view === 'process-digital-twin' || window.location.hash === '#process-digital-twin';
const showLegacyProcessDigitalTwin = view === 'process-digital-twin-legacy' || window.location.hash === '#process-digital-twin-legacy';
const showProcessReliability = view === 'process-reliability' || window.location.hash === '#process-reliability';
const showLegacyProcessReliability = view === 'process-reliability-legacy' || window.location.hash === '#process-reliability-legacy';
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
      ) : showLegacyProcessReliability ? (
        <ProcessReliabilityApp />
      ) : showProcessReliability ? (
        <UniversalProcessReliabilityApp />
      ) : showLegacyProcessDigitalTwin ? (
        <ProcessDigitalTwinApp />
      ) : showProcessDigitalTwin ? (
        <UniversalProcessDigitalTwinApp />
      ) : showLegacyProcessBatchRisk ? (
        <ProcessBatchRiskApp />
      ) : showLegacyProcessBatch ? (
        <ProcessBatchApp />
      ) : showProcessBatchRisk || showProcessBatch ? (
        <UniversalProcessBatchApp />
      ) : showLegacyProcessRisk ? (
        <ProcessRiskApp />
      ) : showProcessRisk ? (
        <UniversalProcessRiskApp />
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
