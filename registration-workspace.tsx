import React from 'react';
import WizardApp from './wizard-app';
import { RegistrationNavigation } from './registration-navigation';
import { RegistrationDeedTable } from './registration-deed-table';
import { RegistrationJurisdiction } from './registration-jurisdiction';
import type { WorkspacePresentation } from './workspace-presentation';
import './registration-workspace.css';

export const registrationPresentation: WorkspacePresentation = {
  name: 'registration-workspace', Navigation: RegistrationNavigation, Library: RegistrationDeedTable, Jurisdiction: RegistrationJurisdiction,
};
export default function RegistrationWorkspace() { return <WizardApp presentation={registrationPresentation} />; }
