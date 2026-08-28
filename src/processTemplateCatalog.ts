import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { ProcessDomainPackManifest } from './processDomainPack';

export interface ProcessTemplateCatalogEntry {
  ref: string;
  packId: string;
  packVersion: string;
  packName: string;
  templateId: string;
  templateName: string;
  description?: string;
  domain?: string;
  tags: string[];
}

export function processTemplateRef(packId: string, templateId: string): string {
  return `${encodeURIComponent(packId)}::${encodeURIComponent(templateId)}`;
}

export function parseProcessTemplateRef(ref: string): { packId: string; templateId: string } | null {
  const separator = ref.indexOf('::');
  if (separator <= 0 || separator >= ref.length - 2) return null;
  try {
    return {
      packId: decodeURIComponent(ref.slice(0, separator)),
      templateId: decodeURIComponent(ref.slice(separator + 2)),
    };
  } catch {
    return null;
  }
}

export function buildProcessTemplateCatalog(packs: ProcessDomainPackManifest[]): ProcessTemplateCatalogEntry[] {
  const entries: ProcessTemplateCatalogEntry[] = [];
  for (const pack of packs) {
    for (const template of pack.profileTemplates || []) {
      entries.push({
        ref: processTemplateRef(pack.id, template.id),
        packId: pack.id,
        packVersion: pack.version,
        packName: pack.name,
        templateId: template.id,
        templateName: template.name,
        description: template.description,
        domain: template.profile.domain,
        tags: [...(template.tags || [])],
      });
    }
  }
  return entries.sort((a, b) =>
    a.packName.localeCompare(b.packName) || a.templateName.localeCompare(b.templateName));
}

export function createScenarioFromTemplateRef(
  packs: ProcessDomainPackManifest[],
  ref: string,
): ProcessScenarioProfile | null {
  const parsed = parseProcessTemplateRef(ref);
  if (!parsed) return null;
  const pack = packs.find(item => item.id === parsed.packId);
  const template = pack?.profileTemplates?.find(item => item.id === parsed.templateId);
  if (!pack || !template) return null;
  const profile = cloneProcessScenario(template.profile);
  profile.metadata = {
    ...(profile.metadata || {}),
    domainPackId: pack.id,
    domainPackVersion: pack.version,
    templateId: template.id,
  };
  return profile;
}
