import React, { useLayoutEffect, useRef } from 'react';
import { Check, AlertCircle, LayoutGrid, ArrowLeft, ArrowRight } from 'lucide-react';
type WorkflowNavigationProps = {
  steps: { id: number; label: string }[];
  current: number;
  completed: number[];
  attention: number[];
  title: string;
  onNavigate: (step: number) => void;
};

const shortLabels: Record<number, string> = { 0: 'Setup', 1: 'Documents', 3: 'Property', 5: 'Payments', 9: 'Generate', 10: 'Property Plan' };

export function WorkflowNavigation({ steps, current, completed, attention, title, onNavigate }: WorkflowNavigationProps) {
  const list = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const reveal = () => {
      const container = list.current;
      const active = container?.querySelector<HTMLElement>('[aria-current="step"]');
      if (!container || !active) return;
      const bounds = container.getBoundingClientRect();
      const item = active.getBoundingClientRect();
      // Scroll this row only. scrollIntoView would also move the whole document.
      if (item.left < bounds.left + 8) container.scrollLeft -= bounds.left + 8 - item.left;
      else if (item.right > bounds.right - 8) container.scrollLeft += item.right - bounds.right + 8;
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    if (list.current) observer.observe(list.current);
    return () => observer.disconnect();
  }, [current, steps]);
  const index = steps.findIndex(step => step.id === current);
  return <nav className="workflow-navigation" aria-label="Deed steps">
    <div className="workflow-nav-context"><strong>{title}</strong><button type="button" aria-current={current === -1 ? 'page' : undefined} onClick={() => onNavigate(-1)}><LayoutGrid size={16} aria-hidden="true" />Draft overview</button><span>{completed.filter(id => !attention.includes(id) && steps.some(step => step.id === id)).length} of {steps.length} sections complete</span></div>
    <ol ref={list} className="workflow-steps">{steps.map((step, position) => {
      const needsReview = attention.includes(step.id); const done = completed.includes(step.id) && !needsReview;
      const status = needsReview ? 'Needs review' : done ? 'Complete' : 'To complete';
      return <li key={step.id}><button type="button" className={`${current === step.id ? 'active ' : ''}${done ? 'complete' : ''}`} aria-label={`${position + 1} ${step.label} — ${status}${step.id >= 10 ? ' — Optional' : ''}`} title={`${step.label} · ${status}${step.id >= 10 ? ' · Optional' : ''}`} aria-current={current === step.id ? 'step' : undefined} onClick={() => onNavigate(step.id)}>
        <span className="workflow-step-number" aria-hidden="true">{done ? <Check size={14} /> : position + 1}</span><strong aria-hidden="true">{shortLabels[step.id] || step.label.replace(/ Details$/, '')}</strong><span className="workflow-step-state" aria-hidden="true">{needsReview ? <AlertCircle size={15} /> : step.id >= 10 ? <small>Optional</small> : null}</span>
      </button></li>;
    })}</ol>
    <div className="workflow-mobile-navigation"><button type="button" aria-label="Previous section" disabled={index < 0} onClick={() => onNavigate(index > 0 ? steps[index - 1].id : -1)}><ArrowLeft size={16} aria-hidden="true" /></button><label htmlFor="mobile-step"><span>Jump to section</span><select id="mobile-step" value={current} onChange={event => onNavigate(Number(event.target.value))}><option value={-1}>Draft overview</option>{steps.map((step, i) => <option key={step.id} value={step.id}>{i + 1}. {step.label}</option>)}</select></label><button type="button" aria-label="Next section" disabled={index === steps.length - 1} onClick={() => onNavigate(steps[index + 1]?.id ?? steps[0].id)}><ArrowRight size={16} aria-hidden="true" /></button></div>
  </nav>;
}
