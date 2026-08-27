import { PortSide, PortType, Port, RoutingOptions } from '../types';

export type InvalidationClass =
  | 'none'
  | 'render'
  | 'semantic'
  | 'routing_cost'
  | 'routing_geometry'
  | 'layout';

export type NamespacedID = string; // e.g. "core/block/process"

export type LifecycleStatus = 'draft' | 'published' | 'deprecated';

export interface ShapeDefinition {
  id: NamespacedID;
  name: string;
  description?: string;
  status: LifecycleStatus;
  version: string;
  baseShape: 'rectangle' | 'rounded' | 'circle' | 'diamond' | 'hexagon' | 'chip_ic' | 'custom';
  cornerRadius?: number;
  aspectRatio?: number;
  clipPathSvg?: string;
}

export interface IconDefinition {
  id: NamespacedID;
  name: string;
  pack?: string;
  status: LifecycleStatus;
  svg: string;
  category?: string;
}

export interface PortTemplate {
  id: string;
  name: string;
  type: PortType;
  dataType?: string;
  preferredSide?: PortSide;
  relativePosition?: number;
  pinNumber?: number;
  minPitch?: number;
  color?: string;
}

export interface BlockTypeDefinition {
  id: NamespacedID;
  name: string;
  description?: string;
  category: 'source' | 'processor' | 'sink' | 'logic' | 'storage' | 'custom';
  status: LifecycleStatus;
  version: string;
  shapeId: NamespacedID;
  iconId?: NamespacedID;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  ports: PortTemplate[];
  headerColor?: string;
  bodyColor?: string;
  borderColor?: string;
  routingProfileId?: NamespacedID;
  customProperties?: Record<string, unknown>;
}

export interface EdgeTypeDefinition {
  id: NamespacedID;
  name: string;
  description?: string;
  status: LifecycleStatus;
  version: string;
  color: string;
  strokeWidth: number;
  dashPattern?: string;
  arrowHead?: 'arrow' | 'circle' | 'diamond' | 'none';
  routingProfileId?: NamespacedID;
}

export interface RoutingProfileDefinition {
  id: NamespacedID;
  name: string;
  description?: string;
  status: LifecycleStatus;
  version: string;
  options: RoutingOptions;
}

export interface ThemeDefinition {
  id: NamespacedID;
  name: string;
  status: LifecycleStatus;
  version: string;
  isDark: boolean;
  canvasBackground: string;
  gridColor: string;
  blockFill: string;
  blockStroke: string;
  textColor: string;
  wireDefault: string;
  wireSelected: string;
  variables?: Record<string, string>;
}

export interface RegistryPackage {
  id: NamespacedID;
  name: string;
  version: string;
  author?: string;
  description?: string;
  checksum?: string;
  shapes?: ShapeDefinition[];
  icons?: IconDefinition[];
  blockTypes?: BlockTypeDefinition[];
  edgeTypes?: EdgeTypeDefinition[];
  routingProfiles?: RoutingProfileDefinition[];
  themes?: ThemeDefinition[];
}

export interface ResolvedBlockStyle {
  typeId: NamespacedID;
  title: string;
  shape: ShapeDefinition;
  width: number;
  height: number;
  headerColor?: string;
  bodyColor?: string;
  borderColor?: string;
  inputs: Port[];
  outputs: Port[];
}
