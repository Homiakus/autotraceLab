/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RoutingOptions, DEFAULT_ROUTING_OPTIONS } from '../types';

export type RoutingProfileType = 'balanced' | 'presentation' | 'eda_compact' | 'fast' | 'workflow';

export const ROUTING_PROFILES: Record<RoutingProfileType, Partial<RoutingOptions>> = {
  balanced: {
    gridSize: 10,
    obstacleClearance: 15,
    bendPenalty: 35,
    crossingPenalty: 25,
    channelSpacing: 14,
    portExitOffset: 20,
    adaptivePortExitOffset: true,
    smoothCorners: true,
    cornerRadius: 12,
    adaptiveCornerRadius: true,
    jumpBridges: false,
    pinAlignment: true,
    artifactCleaning: true,
  },
  presentation: {
    gridSize: 10,
    obstacleClearance: 25,
    bendPenalty: 50,
    crossingPenalty: 40,
    channelSpacing: 20,
    portExitOffset: 25,
    adaptivePortExitOffset: true,
    smoothCorners: true,
    cornerRadius: 16,
    adaptiveCornerRadius: true,
    jumpBridges: true,
    pinAlignment: true,
    artifactCleaning: true,
  },
  eda_compact: {
    gridSize: 5,
    obstacleClearance: 10,
    bendPenalty: 45,
    crossingPenalty: 30,
    channelSpacing: 10,
    portExitOffset: 15,
    adaptivePortExitOffset: true,
    smoothCorners: true,
    cornerRadius: 4,
    adaptiveCornerRadius: false,
    jumpBridges: false,
    pinAlignment: true,
    artifactCleaning: true,
  },
  fast: {
    gridSize: 15,
    obstacleClearance: 12,
    bendPenalty: 20,
    crossingPenalty: 15,
    channelSpacing: 12,
    portExitOffset: 15,
    adaptivePortExitOffset: false,
    smoothCorners: false,
    cornerRadius: 0,
    adaptiveCornerRadius: false,
    jumpBridges: false,
    pinAlignment: false,
    artifactCleaning: true,
  },
  workflow: {
    gridSize: 10,
    obstacleClearance: 20,
    bendPenalty: 40,
    crossingPenalty: 30,
    channelSpacing: 16,
    portExitOffset: 30,
    adaptivePortExitOffset: true,
    smoothCorners: true,
    cornerRadius: 10,
    adaptiveCornerRadius: true,
    jumpBridges: false,
    pinAlignment: true,
    artifactCleaning: true,
  },
};

/**
 * Resolves full RoutingOptions from a profile name or partial overrides.
 */
export function resolveRoutingOptions(
  profileOrOptions?: RoutingProfileType | Partial<RoutingOptions>
): RoutingOptions {
  if (!profileOrOptions) {
    return { ...DEFAULT_ROUTING_OPTIONS };
  }

  if (typeof profileOrOptions === 'string') {
    const profile = ROUTING_PROFILES[profileOrOptions] || ROUTING_PROFILES.balanced;
    return {
      ...DEFAULT_ROUTING_OPTIONS,
      ...profile,
    };
  }

  return {
    ...DEFAULT_ROUTING_OPTIONS,
    ...profileOrOptions,
  };
}
