import {
  NamespacedID,
  RegistryPackage,
  ShapeDefinition,
  IconDefinition,
  BlockTypeDefinition,
  EdgeTypeDefinition,
  RoutingProfileDefinition,
  ThemeDefinition,
} from './types';
import { DEFAULT_BUILTIN_PACKAGE } from './builtins';

export class RegistryStore {
  private shapes = new Map<NamespacedID, ShapeDefinition>();
  private icons = new Map<NamespacedID, IconDefinition>();
  private blockTypes = new Map<NamespacedID, BlockTypeDefinition>();
  private edgeTypes = new Map<NamespacedID, EdgeTypeDefinition>();
  private routingProfiles = new Map<NamespacedID, RoutingProfileDefinition>();
  private themes = new Map<NamespacedID, ThemeDefinition>();
  private packages = new Map<NamespacedID, RegistryPackage>();

  constructor() {
    this.importPackage(DEFAULT_BUILTIN_PACKAGE);
  }

  importPackage(pkg: RegistryPackage): void {
    if (!pkg.id || !pkg.name) {
      throw new Error('Invalid registry package: id and name are required');
    }

    if (pkg.shapes) {
      for (const s of pkg.shapes) this.shapes.set(s.id, s);
    }
    if (pkg.icons) {
      for (const i of pkg.icons) this.icons.set(i.id, i);
    }
    if (pkg.blockTypes) {
      for (const b of pkg.blockTypes) this.blockTypes.set(b.id, b);
    }
    if (pkg.edgeTypes) {
      for (const e of pkg.edgeTypes) this.edgeTypes.set(e.id, e);
    }
    if (pkg.routingProfiles) {
      for (const r of pkg.routingProfiles) this.routingProfiles.set(r.id, r);
    }
    if (pkg.themes) {
      for (const t of pkg.themes) this.themes.set(t.id, t);
    }

    this.packages.set(pkg.id, pkg);
  }

  getBlockType(id: NamespacedID): BlockTypeDefinition | undefined {
    return this.blockTypes.get(id);
  }

  getEdgeType(id: NamespacedID): EdgeTypeDefinition | undefined {
    return this.edgeTypes.get(id);
  }

  getShape(id: NamespacedID): ShapeDefinition | undefined {
    return this.shapes.get(id);
  }

  getTheme(id: NamespacedID): ThemeDefinition | undefined {
    return this.themes.get(id);
  }

  getAllBlockTypes(): BlockTypeDefinition[] {
    return Array.from(this.blockTypes.values());
  }

  getAllEdgeTypes(): EdgeTypeDefinition[] {
    return Array.from(this.edgeTypes.values());
  }

  exportPackage(packageId: NamespacedID): RegistryPackage | undefined {
    return this.packages.get(packageId);
  }
}

export const globalRegistryStore = new RegistryStore();
