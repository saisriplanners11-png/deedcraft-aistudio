import React from 'react';
import { Check, AlertCircle, LayoutGrid, ArrowLeft, ArrowRight } from 'lucide-react';
import type { WorkflowNavigationProps } from './workspace-presentation';

const shortLabels = ['Setup', 'Documents', 'Jurisdiction', 'Property', 'Value', 'Payments', 'Executants', 'Claimants', 'Reverify', 'Generate', 'Plan'];

export function RegistrationNavigation({ steps, current, completed, attention, title, onNavigate }: WorkflowNavigationProps) {
  const index = steps.findIndex(step => step.id === current);
  return <nav className="registration-navigation" aria-label="Deed steps">
    <div className="registration-nav-context"><strong>{title}</strong><button type="button" aria-current={current === -1 ? 'page' : undefined} onClick={() => onNavigate(-1)}><LayoutGrid size={16} aria-hidden="true" />Draft overview</button><span>{completed.filter(id => !attention.includes(id) && steps.some(step => step.id === id)).length} of {steps.length} sections complete</span></div>
    <ol className="registration-steps" style={{ '--registration-step-count': steps.length } as React.CSSProperties}>{steps.map((step, position) => {
      const needsReview = attention.includes(step.id); const done = completed.includes(step.id) && !needsReview;
      const status = needsReview ? 'Needs review' : done ? 'Complete' : 'To complete';
      return <li key={step.id}><button type="button" className={`${current === step.id ? 'active ' : ''}${done ? 'complete' : ''}`} aria-label={`${position + 1} ${step.label} — ${status}${step.id === 10 ? ' — Optional' : ''}`} title={`${step.label} · ${status}${step.id === 10 ? ' · Optional' : ''}`} aria-current={current === step.id ? 'step' : undefined} onClick={() => onNavigate(step.id)}>
        <span className="registration-step-number" aria-hidden="true">{position + 1}</span><strong aria-hidden="true">{shortLabels[step.id] || step.label}</strong><span className="registration-step-state" aria-hidden="true">{needsReview ? <AlertCircle size={11} /> : done ? <Check size={11} /> : null}</span>
      </button></li>;
    })}</ol>
    <div className="registration-mobile-navigation"><button type="button" aria-label="Previous section" disabled={index < 0} onClick={() => onNavigate(index > 0 ? steps[index - 1].id : -1)}><ArrowLeft size={16} aria-hidden="true" /></button><label htmlFor="registration-step"><span className="sr-only">Current section</span><select id="registration-step" value={current} onChange={event => onNavigate(Number(event.target.value))}><option value={-1}>Draft overview</option>{steps.map((step, i) => <option key={step.id} value={step.id}>{i + 1}. {step.label}</option>)}</select></label><button type="button" aria-label="Next section" disabled={index === steps.length - 1} onClick={() => onNavigate(steps[index + 1]?.id ?? steps[0].id)}><ArrowRight size={16} aria-hidden="true" /></button></div>
  </nav>;
}
