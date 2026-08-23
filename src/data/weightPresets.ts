import { OptimizationWeights, WeightPreset } from '../types';

export const DEFAULT_OPTIMIZATION_WEIGHTS: OptimizationWeights = {
  crossingWeight: 95,      // Приоритет №1: Минимизация пересечений линий и блоков
  straightnessWeight: 90,  // Приоритет №2: Прямолинейность основного тела линий
  g1SplineWeight: 65,      // G1 сплайновое скругление в концах/поворотах
  portAlignmentWeight: 80, // Соосность пинов
  clearanceWeight: 90,     // Безопасный отступ от блоков
  wirelengthWeight: 15,    // Вторично: минимизация общей длины
  bendWeight: 25,          // Вторично: штраф за изгибы
  labelOverlapWeight: 75,  // Отсутствие наложений меток
};

export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    id: 'zero_crossings_straight',
    name: 'Zero Crossings & Direct Laser (User Defined)',
    description: 'Абсолютный приоритет отсутствия пересечений, прямолинейность основной длины и G1 сплайны на концах.',
    weights: {
      crossingWeight: 100,
      straightnessWeight: 95,
      g1SplineWeight: 70,
      portAlignmentWeight: 85,
      clearanceWeight: 95,
      wirelengthWeight: 15,
      bendWeight: 25,
      labelOverlapWeight: 80,
    },
  },
  {
    id: 'organic_g1',
    name: 'Organic G1 Spline Continuous',
    description: 'Максимальная плавность G1 сплайнов при сохранении нулевых пересечений и прямых выходов.',
    weights: {
      crossingWeight: 90,
      straightnessWeight: 45,
      g1SplineWeight: 100,
      portAlignmentWeight: 70,
      clearanceWeight: 85,
      wirelengthWeight: 25,
      bendWeight: 10,
      labelOverlapWeight: 70,
    },
  },
  {
    id: 'compact_eda',
    name: 'Compact EDA / Shortest Wire (Classic)',
    description: 'Классический подход САПР: минимизация площади и общей длины соединений (HPWL).',
    weights: {
      crossingWeight: 70,
      straightnessWeight: 50,
      g1SplineWeight: 20,
      portAlignmentWeight: 50,
      clearanceWeight: 75,
      wirelengthWeight: 90,
      bendWeight: 65,
      labelOverlapWeight: 60,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced Multi-Objective',
    description: 'Сбалансированное распределение всех 8 критериев Парето-фронта.',
    weights: {
      crossingWeight: 60,
      straightnessWeight: 60,
      g1SplineWeight: 50,
      portAlignmentWeight: 60,
      clearanceWeight: 60,
      wirelengthWeight: 50,
      bendWeight: 50,
      labelOverlapWeight: 50,
    },
  },
];
