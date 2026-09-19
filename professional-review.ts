import type { InstrumentId } from './instruments';

export type ReviewStatus = 'unreviewed' | 'approved' | 'changes-requested';
export interface ProfessionalApproval {
  status: ReviewStatus;
  reviewerName: string;
  reviewerRole: 'advocate' | 'document-writer' | 'authorized-professional';
  approvedSnapshotHash?: string;
  approvedAt?: string;
  acceptedWarnings: string[];
  note?: string;
}
export interface AuditEvent {
  id: string;
  at: string;
  type: 'draft-created' | 'instrument-selected' | 'manual-edit' | 'source-added' | 'source-removed' | 'review-approved' | 'review-revoked' | 'generated';
  instrumentId: InstrumentId;
  actor: string;
  details: Record<string, string | number | boolean>;
  previousEventHash?: string;
}

export const emptyApproval = (): ProfessionalApproval => ({ status: 'unreviewed', reviewerName: '', reviewerRole: 'authorized-professional', acceptedWarnings: [] });

export function approvalAllowsGeneration(approval: ProfessionalApproval, snapshotHash: string, unresolvedWarnings: string[]) {
  if (approval.status !== 'approved') return false;
  if (!approval.reviewerName.trim() || approval.approvedSnapshotHash !== snapshotHash) return false;
  return unresolvedWarnings.every(warning => approval.acceptedWarnings.includes(warning));
}

/** Any material draft mutation invalidates approval of the former snapshot. */
export function invalidateApproval(approval: ProfessionalApproval): ProfessionalApproval {
  return approval.status === 'unreviewed' ? approval : { ...emptyApproval(), reviewerRole: approval.reviewerRole };
}

