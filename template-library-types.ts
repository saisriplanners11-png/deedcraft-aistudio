import type { InstrumentId } from './instruments';
import type { TemplateValidationResult } from './docx';
import type { TemplateFieldContract, TemplateFieldInspection } from './template-fields';

export interface TemplatePin { saleOpenings?: boolean; versionId: string; hash: string; name: string; bytes?: Uint8Array; fieldContract?: TemplateFieldContract; schemaHash?: string; packageHash?: string; contractVersion?: string }
export interface LibraryRevision {
  id: string;
  instrumentId: InstrumentId;
  saleOpenings?: boolean;
  filename: string;
  hash: string;
  createdAt: string;
  contractVersion: string;
  fieldContract?: TemplateFieldContract;
  schemaHash?: string;
  packageHash?: string;
  schemaRevision?: number;
  inspection?: TemplateFieldInspection;
  samplesSchemaHash?: string;
  expectedSampleCount?: number;
  validation?: TemplateValidationResult;
  publishedAt?: string;
  deletedAt?: string;
  publishedBy?: string;
  reviewedAt?: string;
  samples?: { id: string; label: string; error?: string }[];
}
export interface LibraryListing {
  active: Record<string, string>;
  versions: LibraryRevision[];
  deletedVersions?: LibraryRevision[];
  history?: { versionId: string; previousVersionId?: string; at: string; action: 'publish' | 'rollback' | 'seed' }[];
}
