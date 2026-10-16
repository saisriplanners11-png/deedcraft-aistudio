import React, { createContext, useContext, useId, useLayoutEffect, useRef } from 'react';
import { placementSection, type PlacementHost } from './template-placement';
import './template-placement.css';
export interface MountedPlacementHost extends PlacementHost { key: string; element: HTMLElement }
export const PlacementRegistry = createContext<((key: string, host?: MountedPlacementHost) => void) | null>(null);
export const PlacementRecordContext = createContext({ scope: 'property', id: 'primary' });
export function PlacementRecord({ scope, id, children }: { scope: string; id: string; children: React.ReactNode }) {
  return <PlacementRecordContext.Provider value={{ scope, id }}>{children}</PlacementRecordContext.Provider>;
}
export function PlacementSlot({ sectionId, anchorFieldId, position = 'end' }: { sectionId?: string; anchorFieldId?: string; position?: PlacementHost['position'] }) {
  const register = useContext(PlacementRegistry), record = useContext(PlacementRecordContext);
  const key = useId(), element = useRef<HTMLDivElement>(null);
  const scope = placementSection(sectionId || '')?.scope || record.scope;
  const recordId = scope === 'transaction' ? 'deed' : record.id;
  useLayoutEffect(() => {
    if (!register || !sectionId || !element.current) return;
    register(key, { key, sectionId, anchorFieldId, position, scope, recordId, element: element.current });
    return () => register(key);
  }, [register, key, sectionId, anchorFieldId, position, scope, recordId]);
  return register && sectionId ? <div className="template-placement-slot" data-placement-section={sectionId} data-placement-anchor={anchorFieldId} data-placement-position={position} ref={element} /> : null;
}
export function PlacementAnchor({ sectionId, fieldId, children }: { sectionId: string; fieldId: string; children: React.ReactNode }) {
  return <><PlacementSlot sectionId={sectionId} anchorFieldId={fieldId} position="before" />{children}<PlacementSlot sectionId={sectionId} anchorFieldId={fieldId} position="after" /></>;
}
