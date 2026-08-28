import React from 'react';
import LbcWorkflowApp from './LbcWorkflowApp';
import LbcEngineeringDrilldown from './components/LbcEngineeringDrilldown';
import ProcessMathWorkbench from './components/ProcessMathWorkbench';

export default function LbcWorkflowWorkbench() {
  return (
    <>
      <LbcWorkflowApp />
      <LbcEngineeringDrilldown />
      <ProcessMathWorkbench />
    </>
  );
}
