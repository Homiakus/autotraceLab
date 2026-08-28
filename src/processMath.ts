export type ProcessTimeUnit = 'ms' | 's' | 'min' | 'h';

export interface ProcessTimeInput {
  value: number | null;
  unit: ProcessTimeUnit;
  formula?: string;
}

export interface ProcessFormulaContext {
  [name: string]: number;
}

export interface ProcessFormulaResult {
  ok: boolean;
  value?: number;
  error?: string;
}

export interface ProcessStageMathState {
  id: string;
  title: string;
  automation: string;
  time: ProcessTimeInput;
}

export interface ProcessStats {
  totalSeconds: number;
  serialCriticalPathSeconds: number;
  manualSeconds: number;
  automaticSeconds: number;
  mixedSeconds: number;
  waitSeconds: number;
  externalSeconds: number;
  qcSeconds: number;
  modeledStages: number;
  totalStages: number;
  coveragePercent: number;
  automationTimeSharePercent: number;
  bottleneckStageId?: string;
  bottleneckStageTitle?: string;
  bottleneckSeconds: number;
  throughputPerHour: number | null;
}

const UNIT_TO_SECONDS: Record<ProcessTimeUnit, number> = {
  ms: 0.001,
  s: 1,
  min: 60,
  h: 3600,
};

export function toSeconds(value: number, unit: ProcessTimeUnit): number {
  return value * UNIT_TO_SECONDS[unit];
}

export function fromSeconds(seconds: number, unit: ProcessTimeUnit): number {
  return seconds / UNIT_TO_SECONDS[unit];
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (Math.abs(seconds) < 1) return `${Math.round(seconds * 1000)} мс`;
  if (Math.abs(seconds) < 60) return `${roundSmart(seconds)} с`;
  if (Math.abs(seconds) < 3600) return `${roundSmart(seconds / 60)} мин`;
  return `${roundSmart(seconds / 3600)} ч`;
}

export function roundSmart(value: number): number {
  if (!Number.isFinite(value)) return value;
  const abs = Math.abs(value);
  if (abs >= 100) return Math.round(value);
  if (abs >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/**
 * Tries to extract a single useful duration from a human-readable timing string.
 * It intentionally returns null for ranges because choosing a midpoint would invent precision.
 */
export function extractInitialDuration(text: string): ProcessTimeInput {
  const normalized = text.toLowerCase().replace(',', '.');
  if (/\d\s*[–—-]\s*\d/.test(normalized)) return { value: null, unit: 'min' };

  const match = normalized.match(/(?:<|до|≈|~)?\s*(\d+(?:\.\d+)?)\s*(мс|ms|сек|с\b|мин|минут|ч\b|час)/i);
  if (!match) return { value: null, unit: 'min' };

  const value = Number(match[1]);
  const rawUnit = match[2];
  if (!Number.isFinite(value)) return { value: null, unit: 'min' };
  if (/мс|ms/.test(rawUnit)) return { value, unit: 'ms' };
  if (/мин/.test(rawUnit)) return { value, unit: 'min' };
  if (/ч|час/.test(rawUnit)) return { value, unit: 'h' };
  return { value, unit: 's' };
}

type TokenType = 'number' | 'identifier' | 'operator' | 'lparen' | 'rparen' | 'comma' | 'eof';
interface Token {
  type: TokenType;
  value: string;
}

class FormulaTokenizer {
  private index = 0;
  constructor(private readonly input: string) {}

  next(): Token {
    while (this.index < this.input.length && /\s/.test(this.input[this.index])) this.index += 1;
    if (this.index >= this.input.length) return { type: 'eof', value: '' };

    const char = this.input[this.index];
    if (/[0-9.]/.test(char)) {
      const start = this.index;
      let dots = 0;
      while (this.index < this.input.length && /[0-9.]/.test(this.input[this.index])) {
        if (this.input[this.index] === '.') dots += 1;
        this.index += 1;
      }
      const raw = this.input.slice(start, this.index);
      if (dots > 1 || raw === '.') throw new Error(`Некорректное число: ${raw}`);
      return { type: 'number', value: raw };
    }

    if (/[A-Za-zА-Яа-яЁё_]/.test(char)) {
      const start = this.index;
      while (this.index < this.input.length && /[A-Za-zА-Яа-яЁё0-9_.]/.test(this.input[this.index])) this.index += 1;
      return { type: 'identifier', value: this.input.slice(start, this.index) };
    }

    this.index += 1;
    if ('+-*/^'.includes(char)) return { type: 'operator', value: char };
    if (char === '(') return { type: 'lparen', value: char };
    if (char === ')') return { type: 'rparen', value: char };
    if (char === ',') return { type: 'comma', value: char };
    throw new Error(`Недопустимый символ: ${char}`);
  }
}

class FormulaParser {
  private current: Token;
  private readonly tokenizer: FormulaTokenizer;

  constructor(input: string, private readonly context: ProcessFormulaContext) {
    this.tokenizer = new FormulaTokenizer(input);
    this.current = this.tokenizer.next();
  }

  parse(): number {
    const value = this.parseExpression();
    if (this.current.type !== 'eof') throw new Error(`Лишний фрагмент: ${this.current.value}`);
    if (!Number.isFinite(value)) throw new Error('Результат не является конечным числом');
    return value;
  }

  private advance(): Token {
    const prev = this.current;
    this.current = this.tokenizer.next();
    return prev;
  }

  private parseExpression(): number {
    let value = this.parseTerm();
    while (this.current.type === 'operator' && (this.current.value === '+' || this.current.value === '-')) {
      const op = this.advance().value;
      const rhs = this.parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parsePower();
    while (this.current.type === 'operator' && (this.current.value === '*' || this.current.value === '/')) {
      const op = this.advance().value;
      const rhs = this.parsePower();
      if (op === '/' && rhs === 0) throw new Error('Деление на ноль');
      value = op === '*' ? value * rhs : value / rhs;
    }
    return value;
  }

  private parsePower(): number {
    let value = this.parseUnary();
    if (this.current.type === 'operator' && this.current.value === '^') {
      this.advance();
      value = Math.pow(value, this.parsePower());
    }
    return value;
  }

  private parseUnary(): number {
    if (this.current.type === 'operator' && this.current.value === '-') {
      this.advance();
      return -this.parseUnary();
    }
    if (this.current.type === 'operator' && this.current.value === '+') {
      this.advance();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    if (this.current.type === 'number') return Number(this.advance().value);

    if (this.current.type === 'identifier') {
      const name = this.advance().value;
      if (this.current.type === 'lparen') return this.parseFunction(name);
      if (!(name in this.context)) throw new Error(`Неизвестная переменная: ${name}`);
      return this.context[name];
    }

    if (this.current.type === 'lparen') {
      this.advance();
      const value = this.parseExpression();
      if (this.current.type !== 'rparen') throw new Error('Ожидалась закрывающая скобка');
      this.advance();
      return value;
    }

    throw new Error(`Ожидалось число, переменная или функция, получено: ${this.current.value || 'конец формулы'}`);
  }

  private parseFunction(name: string): number {
    this.advance(); // (
    const args: number[] = [];
    if (this.current.type !== 'rparen') {
      while (true) {
        args.push(this.parseExpression());
        if (this.current.type === 'comma') {
          this.advance();
          continue;
        }
        break;
      }
    }
    if (this.current.type !== 'rparen') throw new Error(`Функция ${name}: ожидалась )`);
    this.advance();

    switch (name.toLowerCase()) {
      case 'sum': return args.reduce((a, b) => a + b, 0);
      case 'avg': return args.length ? args.reduce((a, b) => a + b, 0) / args.length : 0;
      case 'min': return args.length ? Math.min(...args) : 0;
      case 'max': return args.length ? Math.max(...args) : 0;
      case 'ceil': this.requireArgs(name, args, 1); return Math.ceil(args[0]);
      case 'floor': this.requireArgs(name, args, 1); return Math.floor(args[0]);
      case 'round': this.requireArgs(name, args, 1); return Math.round(args[0]);
      case 'abs': this.requireArgs(name, args, 1); return Math.abs(args[0]);
      case 'sqrt': this.requireArgs(name, args, 1); return Math.sqrt(args[0]);
      default: throw new Error(`Неизвестная функция: ${name}`);
    }
  }

  private requireArgs(name: string, args: number[], count: number): void {
    if (args.length !== count) throw new Error(`Функция ${name} ожидает ${count} арг.`);
  }
}

export function evaluateFormula(expression: string, context: ProcessFormulaContext): ProcessFormulaResult {
  const trimmed = expression.trim();
  if (!trimmed) return { ok: false, error: 'Формула не задана' };
  try {
    const value = new FormulaParser(trimmed, context).parse();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Ошибка формулы' };
  }
}

/**
 * Resolves stages left-to-right. A formula therefore can refer to any already resolved stage as `<stageId>.time`.
 * All formula values are expressed in seconds. This keeps units dimensionally predictable.
 */
export function resolveStageTimes(stages: ProcessStageMathState[], extraContext: ProcessFormulaContext = {}): {
  secondsByStage: Record<string, number>;
  errorsByStage: Record<string, string>;
  context: ProcessFormulaContext;
} {
  const context: ProcessFormulaContext = { ...extraContext };
  const secondsByStage: Record<string, number> = {};
  const errorsByStage: Record<string, string> = {};

  for (const stage of stages) {
    const expression = stage.time.formula?.trim();
    let seconds: number | null = null;

    if (expression) {
      const result = evaluateFormula(expression, context);
      if (result.ok && result.value != null) seconds = result.value;
      else errorsByStage[stage.id] = result.error || 'Ошибка формулы';
    } else if (stage.time.value != null && Number.isFinite(stage.time.value)) {
      seconds = toSeconds(stage.time.value, stage.time.unit);
    }

    if (seconds != null && Number.isFinite(seconds) && seconds >= 0) {
      secondsByStage[stage.id] = seconds;
      context[`${stage.id}.time`] = seconds;
      context[stage.id] = seconds;
    } else if (seconds != null && seconds < 0) {
      errorsByStage[stage.id] = 'Время не может быть отрицательным';
    }
  }

  return { secondsByStage, errorsByStage, context };
}

export function calculateProcessStats(
  stages: ProcessStageMathState[],
  secondsByStage: Record<string, number>,
  batchSize = 1,
): ProcessStats {
  let totalSeconds = 0;
  let manualSeconds = 0;
  let automaticSeconds = 0;
  let mixedSeconds = 0;
  let waitSeconds = 0;
  let externalSeconds = 0;
  let qcSeconds = 0;
  let bottleneckSeconds = 0;
  let bottleneckStageId: string | undefined;
  let bottleneckStageTitle: string | undefined;

  for (const stage of stages) {
    const seconds = secondsByStage[stage.id];
    if (!Number.isFinite(seconds)) continue;
    totalSeconds += seconds;
    if (seconds > bottleneckSeconds) {
      bottleneckSeconds = seconds;
      bottleneckStageId = stage.id;
      bottleneckStageTitle = stage.title;
    }
    switch (stage.automation) {
      case 'manual': manualSeconds += seconds; break;
      case 'automatic': automaticSeconds += seconds; break;
      case 'mixed': mixedSeconds += seconds; break;
      case 'wait': waitSeconds += seconds; break;
      case 'external': externalSeconds += seconds; break;
      case 'qc': qcSeconds += seconds; break;
      default: break;
    }
  }

  const modeledStages = Object.keys(secondsByStage).length;
  const automationDenominator = manualSeconds + automaticSeconds + mixedSeconds + waitSeconds + externalSeconds;
  const automationTimeSharePercent = automationDenominator > 0
    ? (automaticSeconds / automationDenominator) * 100
    : 0;
  const normalizedBatch = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : 1;
  const throughputPerHour = totalSeconds > 0 ? normalizedBatch / (totalSeconds / 3600) : null;

  return {
    totalSeconds,
    serialCriticalPathSeconds: totalSeconds,
    manualSeconds,
    automaticSeconds,
    mixedSeconds,
    waitSeconds,
    externalSeconds,
    qcSeconds,
    modeledStages,
    totalStages: stages.length,
    coveragePercent: stages.length ? (modeledStages / stages.length) * 100 : 0,
    automationTimeSharePercent,
    bottleneckStageId,
    bottleneckStageTitle,
    bottleneckSeconds,
    throughputPerHour,
  };
}
