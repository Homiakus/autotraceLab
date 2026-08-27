import { GoogleGenAI } from '@google/genai';
import {
  BlockNode,
  EdgeConnection,
  RoutingOptions,
  OptimizationWeights,
} from '../types';
import { DEFAULT_OPTIMIZATION_WEIGHTS } from '../data/weightPresets';

export type AITuningProfile = 'eda_compact' | 'presentation' | 'bus_dense' | 'zero_bends' | 'custom';

export interface DiagramTopologySummary {
  nodeCount: number;
  edgeCount: number;
  totalPins: number;
  maxPinsOnSingleBlock: number;
  densityScore: 'low' | 'medium' | 'high' | 'dense_bus';
  semanticCategories: string[];
  aspectRatio: number;
  estimatedCrossings: number;
}

export interface AITunedParametersResult {
  options: Partial<RoutingOptions>;
  weights?: OptimizationWeights;
  profileName: string;
  reasoning: string;
  source: 'gemini_llm' | 'local_neural_heuristics';
  adjustedFields: string[];
}

/**
 * Extracts a compact topology summary from the current diagram state for LLM/Heuristic analysis
 */
export function extractTopologySummary(
  nodes: BlockNode[] = [],
  edges: EdgeConnection[] = []
): DiagramTopologySummary {
  const safeNodes = nodes || [];
  const safeEdges = edges || [];
  const nodeCount = safeNodes.length;
  const edgeCount = safeEdges.length;

  let totalPins = 0;
  let maxPins = 0;
  const categoriesSet = new Set<string>();

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (const node of nodes) {
    const inCount = node.inputs?.length || 0;
    const outCount = node.outputs?.length || 0;
    const pinSum = inCount + outCount;
    totalPins += pinSum;
    if (pinSum > maxPins) maxPins = pinSum;

    if (node.category) categoriesSet.add(node.category);
    if (node.semanticType) categoriesSet.add(node.semanticType);

    if (node.x < minX) minX = node.x;
    if (node.x + node.width > maxX) maxX = node.x + node.width;
    if (node.y < minY) minY = node.y;
    if (node.y + node.height > maxY) maxY = node.y + node.height;
  }

  const width = Math.max(100, maxX - (minX === Infinity ? 0 : minX));
  const height = Math.max(100, maxY - (minY === Infinity ? 0 : minY));
  const aspectRatio = Number((width / height).toFixed(2));

  // Determine density
  const edgeToNodeRatio = nodeCount > 0 ? edgeCount / nodeCount : 0;
  let densityScore: 'low' | 'medium' | 'high' | 'dense_bus' = 'medium';

  if (maxPins >= 6 || edgeToNodeRatio >= 2.0) {
    densityScore = 'dense_bus';
  } else if (edgeToNodeRatio > 1.3 || nodeCount > 8) {
    densityScore = 'high';
  } else if (edgeToNodeRatio < 0.8 && nodeCount <= 4) {
    densityScore = 'low';
  }

  // Rough estimate of crossing potential (simple bounding box overlap heuristic)
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (
        edges[i].sourceBlockId !== edges[j].sourceBlockId &&
        edges[i].targetBlockId !== edges[j].targetBlockId &&
        edges[i].sourceBlockId !== edges[j].targetBlockId
      ) {
        crossings++;
      }
    }
  }

  return {
    nodeCount,
    edgeCount,
    totalPins,
    maxPinsOnSingleBlock: maxPins,
    densityScore,
    semanticCategories: Array.from(categoriesSet),
    aspectRatio,
    estimatedCrossings: Math.min(10, Math.floor(crossings / 2)),
  };
}

/**
 * Local deterministic heuristic engine: Generates instant optimal parameters
 * based on topology and design profile when offline or before LLM responds.
 */
export function tuneParametersLocalHeuristics(
  summary: DiagramTopologySummary,
  intent: string = 'balanced'
): AITunedParametersResult {
  const lowerIntent = intent.toLowerCase();
  const adjustedFields: string[] = [];

  let clearance = 15;
  let channelSpacing = 14;
  let labelClearance = 14;
  let cornerRadius = 12;
  let adaptiveCornerRadius = true;
  let bendPenalty = 35;
  let stub = 20;
  let pinAlignment = true;
  let artifactCleaning = true;
  let jumpBridges = false;
  let profileName = 'Сбалансированная автонастройка';
  let reasoning = '';

  if (lowerIntent.includes('eda') || lowerIntent.includes('плат') || lowerIntent.includes('pcb') || lowerIntent.includes('компакт')) {
    profileName = 'Компактная топология EDA';
    clearance = 10;
    channelSpacing = 12;
    labelClearance = 12;
    cornerRadius = 4;
    adaptiveCornerRadius = false;
    bendPenalty = 45;
    stub = summary.maxPinsOnSingleBlock >= 4 ? 25 : 15;
    jumpBridges = summary.estimatedCrossings > 1;
    reasoning = `Оптимизировано под плотную компоновку: снижен зазор от блоков (${clearance}px) и шаг каналов (${channelSpacing}px). ${jumpBridges ? 'Включены IEEE 315 мостики для читаемости пересечений.' : ''} Bend Penalty ${bendPenalty} для четких прямых линий.`;
  } else if (lowerIntent.includes('презентац') || lowerIntent.includes('слайд') || lowerIntent.includes('ux') || lowerIntent.includes('красив') || lowerIntent.includes('presentation')) {
    profileName = 'Презентация и Инфографика';
    clearance = 25;
    channelSpacing = 20;
    labelClearance = 18;
    cornerRadius = 14;
    adaptiveCornerRadius = true;
    bendPenalty = 25;
    stub = 20;
    jumpBridges = false;
    reasoning = `Оптимизировано для презентаций: увеличены зазоры (${clearance}px) и расстояния между трассами (${channelSpacing}px), активированы скругления G¹ (${cornerRadius}px) с адаптивным радиусом для мягкого визуального восприятия.`;
  } else if (lowerIntent.includes('шин') || lowerIntent.includes('bus') || lowerIntent.includes('mcu') || summary.densityScore === 'dense_bus') {
    profileName = 'Плотная шинная трассировка (Bus)';
    clearance = 15;
    channelSpacing = 12;
    labelClearance = 14;
    cornerRadius = 8;
    adaptiveCornerRadius = true;
    bendPenalty = 40;
    stub = Math.max(25, summary.maxPinsOnSingleBlock * 4);
    pinAlignment = true;
    artifactCleaning = true;
    reasoning = `Обнаружена высокая концентрация пинов (до ${summary.maxPinsOnSingleBlock} на блок). Вылет портов увеличен до ${stub}px во избежание скученности проводов у контактов, соосность 0-Bend активирована.`;
  } else if (lowerIntent.includes('изгиб') || lowerIntent.includes('прям') || lowerIntent.includes('zero') || lowerIntent.includes('straight')) {
    profileName = 'Минимум изгибов (Laser Straight)';
    clearance = 15;
    channelSpacing = 16;
    labelClearance = 14;
    cornerRadius = 10;
    adaptiveCornerRadius = true;
    bendPenalty = 65;
    stub = 20;
    pinAlignment = true;
    reasoning = `Штраф за изгибы повышен до ${bendPenalty}: приоритет прямым горизонтальным и вертикальным связям с минимальным числом поворотов.`;
  } else {
    // General adaptive based on topology summary
    if (summary.densityScore === 'high') {
      clearance = 12;
      channelSpacing = 12;
      stub = 22;
      bendPenalty = 40;
      reasoning = `Плотная схема (${summary.nodeCount} блоков, ${summary.edgeCount} связей): зазоры уплотнены до ${clearance}px, шаг каналов ${channelSpacing}px, соосность и фильтрация паразитных изгибов включены.`;
    } else {
      clearance = 15;
      channelSpacing = 14;
      stub = 20;
      bendPenalty = 35;
      reasoning = `Сбалансированная схема: зазор ${clearance}px, шаг трасс ${channelSpacing}px, скругление ${cornerRadius}px. Оптимально для детерминированного A* роутера.`;
    }
  }

  adjustedFields.push('obstacleClearance', 'channelSpacing', 'cornerRadius', 'bendPenalty', 'portExitOffset');

  return {
    options: {
      obstacleClearance: clearance,
      channelSpacing,
      minWireDistance: channelSpacing,
      labelClearance,
      cornerRadius,
      adaptiveCornerRadius,
      bendPenalty,
      portExitOffset: stub,
      pinAlignment,
      artifactCleaning,
      jumpBridges,
    },
    weights: {
      ...DEFAULT_OPTIMIZATION_WEIGHTS,
      bendWeight: Math.min(100, bendPenalty),
      clearanceWeight: clearance > 15 ? 70 : 50,
      portAlignmentWeight: pinAlignment ? 85 : 50,
    },
    profileName,
    reasoning,
    source: 'local_neural_heuristics',
    adjustedFields,
  };
}

/**
 * Tunes routing parameters using Gemini LLM (with instant fallback to local heuristics)
 */
export async function tuneRoutingParametersWithAI(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  userPrompt: string = '',
  apiKeyOverride?: string
): Promise<AITunedParametersResult> {
  const summary = extractTopologySummary(nodes, edges);

  const apiKey =
    apiKeyOverride ||
    (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_GEMINI_API_KEY) ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('autotrace_gemini_api_key') : null) ||
    '';

  // If no API key is present or key is placeholder, use the fast local neural heuristic engine
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length === 0) {
    return tuneParametersLocalHeuristics(summary, userPrompt || 'balanced');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are an elite electronic design automation (EDA) and diagram layout hyperparameter tuning expert.
Your job is to analyze the graph topology summary and user intent, and determine optimal routing and layout parameters for deterministic Orthogonal A* and Sugiyama router.

Valid parameter boundaries:
- obstacleClearance: 5 to 35 (integer px)
- channelSpacing: 8 to 40 (integer px)
- labelClearance: 8 to 32 (integer px)
- cornerRadius: 0 to 24 (integer px, 0 = sharp 90-degree corners, >0 = smooth G1 fillets)
- adaptiveCornerRadius: boolean (true = dynamically scale radius based on segment length)
- bendPenalty: 0 to 80 (integer cost penalty for turns in A*)
- portExitOffset: 10 to 40 (integer px stub extending from port before turning)
- pinAlignment: boolean (true = prioritize direct 0-bend co-axial pin alignment)
- artifactCleaning: boolean (true = run automatic zig-zag and loop remover)
- jumpBridges: boolean (true = render IEEE 315 line hop arches on orthogonal crossings)

Respond ONLY with valid JSON matching this schema:
{
  "profileName": "Short descriptive name in Russian",
  "obstacleClearance": number,
  "channelSpacing": number,
  "labelClearance": number,
  "cornerRadius": number,
  "adaptiveCornerRadius": boolean,
  "bendPenalty": number,
  "portExitOffset": number,
  "pinAlignment": boolean,
  "artifactCleaning": boolean,
  "jumpBridges": boolean,
  "reasoning": "Clear explanation in Russian of why these specific parameters were chosen based on the diagram topology and user prompt."
}`;

    const promptText = `Analyze this diagram topology:
${JSON.stringify(summary, null, 2)}

User Custom Intent / Goal: "${userPrompt || 'Автоматически оптимизируй параметры под топологию схемы'}"

Generate the optimal routing hyperparameters as JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim();
    if (!text) {
      return tuneParametersLocalHeuristics(summary, userPrompt);
    }

    const parsed = JSON.parse(text);

    // Sanitize and clamp values within safe bounds
    const obstacleClearance = Math.max(5, Math.min(35, Math.round(Number(parsed.obstacleClearance) || 15)));
    const channelSpacing = Math.max(8, Math.min(40, Math.round(Number(parsed.channelSpacing) || 14)));
    const labelClearance = Math.max(8, Math.min(32, Math.round(Number(parsed.labelClearance) || 14)));
    const cornerRadius = Math.max(0, Math.min(24, Math.round(Number(parsed.cornerRadius) || 12)));
    const adaptiveCornerRadius = parsed.adaptiveCornerRadius !== false;
    const bendPenalty = Math.max(0, Math.min(80, Math.round(Number(parsed.bendPenalty) || 35)));
    const portExitOffset = Math.max(10, Math.min(40, Math.round(Number(parsed.portExitOffset) || 20)));
    const pinAlignment = parsed.pinAlignment !== false;
    const artifactCleaning = parsed.artifactCleaning !== false;
    const jumpBridges = Boolean(parsed.jumpBridges);

    const adjustedFields = [
      'obstacleClearance',
      'channelSpacing',
      'labelClearance',
      'cornerRadius',
      'bendPenalty',
      'portExitOffset',
    ];

    return {
      options: {
        obstacleClearance,
        channelSpacing,
        minWireDistance: channelSpacing,
        labelClearance,
        cornerRadius,
        adaptiveCornerRadius,
        bendPenalty,
        portExitOffset,
        pinAlignment,
        artifactCleaning,
        jumpBridges,
      },
      weights: {
        ...DEFAULT_OPTIMIZATION_WEIGHTS,
        bendWeight: Math.min(100, bendPenalty),
        clearanceWeight: obstacleClearance > 15 ? 70 : 50,
        portAlignmentWeight: pinAlignment ? 85 : 50,
      },
      profileName: parsed.profileName || 'AI Оптимизация (Gemini)',
      reasoning: parsed.reasoning || 'Параметры рассчитаны нейросетью Gemini под текущую структуру связей.',
      source: 'gemini_llm',
      adjustedFields,
    };
  } catch (err) {
    console.warn('[AI Parameter Tuner] Gemini API call failed, using local heuristics fallback:', err);
    const fallback = tuneParametersLocalHeuristics(summary, userPrompt);
    fallback.reasoning = `(Fallback) ${fallback.reasoning}`;
    return fallback;
  }
}
