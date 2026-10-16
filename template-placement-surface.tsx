import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { TemplateAdditionalFields } from './template-additional-fields';
import { PlacementRegistry, PlacementRecord, PlacementSlot, type MountedPlacementHost } from './template-placement-context';
import { matchingHosts, placementOrder, placementSection, placementStepIndex } from './template-placement';

type EditorProps = React.ComponentProps<typeof TemplateAdditionalFields>;
export function TemplatePlacementSurface({ step, activePropertyId, children, ...editor }: EditorProps & { step: number; activePropertyId: string; children: React.ReactNode }) {
  const [hosts, setHosts] = useState<Map<string, MountedPlacementHost>>(() => new Map());
  const register = useCallback((key: string, host?: MountedPlacementHost) => setHosts(old => {
    if (!host && !old.has(key)) return old;
    const next = new Map(old); if (host) next.set(key, host); else next.delete(key); return next;
  }), []);
  const orderedHosts = [...hosts.values()].filter(host => host.element.isConnected).sort((a, b) => a.element.compareDocumentPosition(b.element) & 4 ? -1 : 1);
  const fallback = orderedHosts.find(host => host.sectionId === '__fallback');
  const assignments = new Map<string, { host: MountedPlacementHost; instances: EditorProps['instances'] }>();
  for (const instance of [...editor.instances].sort((a, b) => placementOrder(a.field, b.field))) {
    const placement = instance.field.placement;
    if (!placement || placementStepIndex(placement) !== step) continue;
    // Property cards on Steps 1–4 show only the currently selected schedule.
    if (instance.record.scope === 'property' && placementSection(placement.sectionId)?.scope === 'property' && step <= 3 && instance.record.id !== activePropertyId) continue;
    let candidates = matchingHosts(orderedHosts, placement, instance.record);
    if (placementSection(placement.sectionId)?.scope !== instance.record.scope && candidates.length) candidates = candidates.filter(host => host.scope === candidates[0].scope && host.recordId === candidates[0].recordId);
    const target = (placement.position === 'end' ? candidates.at(-1) : candidates[0]) || fallback;
    if (!target) continue;
    if (!assignments.has(target.key)) assignments.set(target.key, { host: target, instances: [] });
    assignments.get(target.key)!.instances.push(instance);
  }
  return <PlacementRegistry.Provider value={register}><PlacementRecord scope="property" id={activePropertyId}>{children}</PlacementRecord>
    {([...assignments.values()].map(({ host, instances }) => createPortal(<>{instances.map(instance => <TemplateAdditionalFields key={`${instance.field.id}:${instance.record.scope}:${instance.record.id}`} {...editor} instances={[instance]} inline />)}</>, host.element, host.key)))}
  </PlacementRegistry.Provider>;
}

export function TemplatePlacementFallback() {
  return <section className="panel template-placement-fallback"><h2>Template fields for this step</h2><p>The configured section or field is not shown for this record. Enter the required information here.</p><div className="deed-field-grid"><PlacementSlot sectionId="__fallback" /></div></section>;
}
