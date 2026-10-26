import type React from 'react';
import type { Field, Group } from './fields';
import type { SavedDeed } from './saved-deeds';
import type { JurisdictionLookupState } from './registration-location-state';

export type FieldRenderer = (field: Field, value: string, onChange: (value: string) => void) => React.ReactNode;
export type WorkflowNavigationProps = {
  steps: { id: number; label: string; sub: string; phase: number }[];
  current: number; completed: number[]; attention: number[]; title: string;
  onNavigate: (step: number) => void;
};
export type SavedDeedsPresentationProps = {
  deeds: SavedDeed[];
  templateLabel: (deed: SavedDeed) => string;
  onOpen: (deed: SavedDeed) => void;
  onRemove: (deed: SavedDeed) => void;
};
export type JurisdictionPresentationProps = {
  propertyId: string;
  values: Record<string, string>;
  lookup: JurisdictionLookupState;
  onLookupChange: (state: JurisdictionLookupState) => void;
  onEdit: (field: string, value: string) => void;
  renderFields: (options?: { groups?: Group[]; renderField?: FieldRenderer }) => React.ReactNode;
};
/** Presentation components receive controlled data/actions; the wizard owns the workflow. */
export type WorkspacePresentation = {
  name: string;
  Navigation: React.ComponentType<WorkflowNavigationProps>;
  Library: React.ComponentType<SavedDeedsPresentationProps>;
  Jurisdiction: React.ComponentType<JurisdictionPresentationProps>;
};
