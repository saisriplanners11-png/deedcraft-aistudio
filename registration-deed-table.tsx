import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { partyRecords } from './logic';
import { appStateFor } from './source-draft';
import { partyDisplayName } from './party-entities';
import { STEPS } from './reference';
import { normalizeWorkflowStep } from './workflow-steps';
import type { SavedDeedsPresentationProps } from './workspace-presentation';

export function RegistrationDeedTable({ deeds, templateLabel, onOpen, onRemove }: SavedDeedsPresentationProps) {
  return <div className="registration-deed-table"><table><caption className="sr-only">Saved deeds and drafting actions</caption><thead><tr><th scope="col">Claimant / deed</th><th scope="col">Document type</th><th scope="col">Last section</th><th scope="col">Sources</th><th scope="col">Template / last edited</th><th scope="col">Actions</th></tr></thead><tbody>{deeds.map(deed => {
    const name = partyRecords(appStateFor(deed.draft), 'claimant').map(party => partyDisplayName(party.values, 'claimant')).filter(Boolean).join(', ') || deed.claimantNames?.join(', ') || `Untitled ${deed.deedType.toLowerCase()}`;
    return <tr key={deed.id}><th scope="row" data-label="Claimant / deed">{name}</th><td data-label="Document type">{deed.draft.instrumentId === 'agreement_of_sale' ? 'Agreement of Sale Cum GPA' : deed.deedType}</td><td data-label="Last section">{STEPS[normalizeWorkflowStep(deed.draft.instrumentId, deed.draft.step)]?.label || 'Overview'}</td><td data-label="Sources">{deed.draft.sources.length}</td><td data-label="Template / last edited"><span>{templateLabel(deed)}</span><small>{new Date(deed.updatedAt).toLocaleString('en-IN')}</small></td><td data-label="Actions"><div className="registration-row-actions"><button type="button" className="primary" onClick={() => onOpen(deed)}><Pencil size={15} aria-hidden="true" />Continue / Edit<span className="sr-only"> {name}</span></button><button type="button" aria-label={`Delete ${name}`} onClick={() => onRemove(deed)}><Trash2 size={16} aria-hidden="true" /></button></div></td></tr>;
  })}</tbody></table></div>;
}
