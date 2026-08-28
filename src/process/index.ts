/**
 * AutoTrace Universal Process Core public API.
 *
 * Keep domain/application code behind ProcessScenarioProfile and Domain Packs.
 * Consumers should prefer imports from this barrel instead of src/* implementation paths.
 */

export const PROCESS_CORE_API_VERSION = '1.0.0' as const;
export const PROCESS_SCENARIO_SCHEMA_VERSION = '1.0' as const;
export const PROCESS_DOMAIN_PACK_SCHEMA_VERSION = '1.0' as const;

export type {
  ProcessAttributeValue,
  ProcessAttributeMap,
  ProcessJobDescriptor,
  BatchCompatibilityMode,
  ProcessBatchCompatibilityRule,
  ProcessBatchCompatibilityPolicy,
  ProcessChangeoverMatrix,
  ProcessChangeoverPolicy,
  ProcessObjectiveGoal,
  ProcessOptimizationObjective,
  ProcessScenarioProfile,
  ProcessScenarioValidation,
} from '../processDomain';
export { validateProcessScenario, cloneProcessScenario } from '../processDomain';

export {
  areJobsCompatible,
  isJobCompatibleWithBatch,
  partitionCompatibleJobs,
  setupStateForJob,
  changeoverSeconds,
  orderJobsByChangeover,
} from '../processCompatibility';
export type { ChangeoverSequenceStep } from '../processCompatibility';

export type {
  UniversalChangeoverResourceStats,
  UniversalPolicyStats,
  UniversalPolicyTwinResult,
} from '../processUniversalScheduler';
export { simulateUniversalPolicyTwin } from '../processUniversalScheduler';

export type {
  CompiledUniversalScenario,
  UniversalSimulationStats,
  UniversalSimulationResult,
} from '../processUniversalCompiler';
export { compileUniversalScenario, simulateUniversalScenario } from '../processUniversalCompiler';

export type {
  UniversalMonteCarloOptions,
  UniversalMonteCarloResult,
  UniversalCapacityScenario,
  UniversalCapacityPlannerResult,
} from '../processUniversalRisk';
export {
  runUniversalProcessMonteCarlo,
  planUniversalResourceCapacity,
  symmetricUncertainty,
  uncertaintyPercent,
  setSymmetricBlockUncertainty,
} from '../processUniversalRisk';

export type {
  UniversalReliabilityOptions,
  UniversalReliabilityResourceStats,
  UniversalReliabilityResult,
  FailurePolicyInput,
} from '../processUniversalReliability';
export {
  runUniversalReliabilityMonteCarlo,
  setResourceFailurePolicy,
  failurePolicyForResource,
} from '../processUniversalReliability';

export type {
  ProcessMetricSnapshot,
  ProcessObjectiveScore,
  ProcessScenarioScore,
} from '../processUniversalObjectives';
export { universalMetricSnapshot, scoreUniversalScenario } from '../processUniversalObjectives';

export type {
  ProcessAttributeDataType,
  ProcessAttributeDefinition,
  ProcessVocabulary,
  ProcessProfileTemplate,
  ProcessDomainPackManifest,
  ProcessDomainPackValidation,
  ProcessJobValidationContext,
  ProcessRuntimeAdapter,
} from '../processDomainPack';
export {
  validateProcessDomainPack,
  validateJobAgainstPack,
  ProcessDomainPackRegistry,
  processDomainPackRegistry,
} from '../processDomainPack';

export {
  MANUFACTURING_DOMAIN_PACK,
  SERVICE_DOMAIN_PACK,
  COMPUTE_DOMAIN_PACK,
  BUILT_IN_PROCESS_DOMAIN_PACKS,
  registerBuiltInProcessDomainPacks,
} from '../processBuiltInPacks';

export type { ProcessParseResult } from '../processProfileIO';
export {
  parseProcessScenario,
  serializeProcessScenario,
  parseProcessDomainPack,
  serializeProcessDomainPack,
} from '../processProfileIO';

export type { ProcessTemplateCatalogEntry } from '../processTemplateCatalog';
export {
  processTemplateRef,
  parseProcessTemplateRef,
  buildProcessTemplateCatalog,
  createScenarioFromTemplateRef,
} from '../processTemplateCatalog';

export type {
  LegacyProcessMathModel,
  ProcessMathProfileMetadata,
} from '../processMathProfile';
export {
  PROCESS_MATH_PROFILE_STORAGE_KEY,
  LEGACY_PROCESS_MATH_STORAGE_KEY,
  getProcessMathMetadata,
  withProcessMathMetadata,
  createBlankProcessMathScenario,
  resizeProcessScenarioJobs,
  migrateLegacyProcessMathModel,
} from '../processMathProfile';

export type { ProcessSimulationReadiness } from '../processSimulationProfile';
export {
  PROCESS_SIMULATION_PROFILE_STORAGE_KEY,
  LEGACY_RESOURCE_SIMULATION_STORAGE_KEY,
  createBlankProcessSimulationScenario,
  migrateLegacyResourceSimulationModel,
  resizeSimulationJobs,
  setFixedArrivalInterval,
  upsertProcessResource,
  removeProcessResourceFromScenario,
  setBlockResourceRequirement,
  applyAutomationResourceDefaults,
  evaluateProcessSimulationReadiness,
} from '../processSimulationProfile';

export type { ProcessBatchReadiness } from '../processBatchProfile';
export {
  LEGACY_BATCH_SIMULATION_STORAGE_KEY,
  getBatchPolicy,
  setProcessBatchPolicy,
  removeProcessBatchPolicy,
  migrateLegacyBatchPolicies,
  defaultBatchPolicyForBlock,
  evaluateProcessBatchReadiness,
} from '../processBatchProfile';

export type { DailyResourceScheduleInput } from '../processDigitalTwinProfile';
export {
  setProcessArrival,
  setProcessRetry,
  retryPercent,
  setPeriodicJobPriority,
  setDailyResourceSchedule,
  evaluateDigitalTwinReadiness,
} from '../processDigitalTwinProfile';

export type {
  LegacyResourceSimulationModel,
  LegacyResourceAdapterOptions,
} from '../processLegacyAdapters';
export { legacyResourceModelToProcessScenario } from '../processLegacyAdapters';

// Supporting policy contracts used by ProcessScenarioProfile.
export type { ProcessResource, ProcessResourceRequirement } from '../processSimulation';
export type { ProcessBatchConfig } from '../processBatchSimulation';
export type { ProcessBlockUncertainty, ProcessMonteCarloDistribution } from '../processRisk';
export type {
  DigitalTwinArrivalKind,
  DigitalTwinArrivalConfig,
  DigitalTwinReworkPolicy,
  DigitalTwinPriorityConfig,
} from '../processDigitalTwin';
export type {
  ProcessWorkingWindow,
  ProcessDowntimeMode,
  ProcessDowntimeWindow,
  ProcessResourceCalendarPolicy,
  ProcessAvailabilityResult,
} from '../processResourceCalendar';
export {
  nextResourceAvailableStart,
  isResourceAvailable,
  availableSecondsWithin,
} from '../processResourceCalendar';
export type {
  RepairDistributionKind,
  ResourceFailurePolicy,
} from '../processReliability';
