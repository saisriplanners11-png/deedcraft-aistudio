import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Check, LayoutGrid, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

type WorkflowNavigationProps = {
  steps: { id: number; label: string }[];
  current: number;
  completed: number[];
  attention: number[];
  title: string;
  onNavigate: (step: number) => void;
};

export function WorkflowNavigation({ steps, current, completed, attention, title, onNavigate }: WorkflowNavigationProps) {
  const [expanded, setExpanded] = useState(() => !window.matchMedia('(max-width: 767px)').matches);
  const contentId = useId();
  const list = useRef<HTMLOListElement>(null);
  const index = steps.findIndex(step => step.id === current);
  const completeCount = steps.filter(step => completed.includes(step.id) && !attention.includes(step.id)).length;

  useLayoutEffect(() => {
    const container = list.current;
    const active = container?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!expanded || !container || !active) return;
    const bounds = container.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.top < bounds.top) container.scrollTop -= bounds.top - item.top;
    else if (item.bottom > bounds.bottom) container.scrollTop += item.bottom - bounds.bottom;
  }, [current, expanded]);

  const ToggleIcon = expanded ? PanelLeftClose : PanelLeftOpen;
  const toggleLabel = expanded ? 'Collapse deed steps' : 'Expand deed steps';

  return <nav className="workflow-navigation" aria-label="Deed steps" data-expanded={expanded}>
    <div className="workflow-rail-header">
      <button type="button" className="workflow-rail-toggle" aria-label={toggleLabel} title={toggleLabel} aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded(value => !value)}>
        <ToggleIcon size={19} aria-hidden="true" />
      </button>
    </div>
    <div id={contentId} className="workflow-rail-content" hidden={!expanded}>
      <div className="workflow-nav-context">
        <strong>{title}</strong>
        <span>{completeCount} of {steps.length} sections complete</span>
        <button type="button" aria-current={current === -1 ? 'page' : undefined} onClick={() => onNavigate(-1)}><LayoutGrid size={16} aria-hidden="true" />Draft overview</button>
      </div>
      <ol ref={list} className="workflow-steps">{steps.map((step, position) => {
        const needsReview = attention.includes(step.id);
        const done = completed.includes(step.id) && !needsReview;
        const status = needsReview ? 'Needs review' : done ? 'Complete' : 'To complete';
        const optional = step.id >= 10;
        const label = `${position + 1} ${step.label} — ${status}${optional ? ' — Optional' : ''}`;
        return <li key={step.id}>
          <button type="button" className={`${current === step.id ? 'active ' : ''}${done ? 'complete' : ''}`} aria-label={label} title={label} aria-current={current === step.id ? 'step' : undefined} onClick={() => onNavigate(step.id)}>
            <span className="workflow-step-number" aria-hidden="true">{done ? <Check size={14} /> : position + 1}</span>
            <strong aria-hidden="true">{step.label}</strong>
            <span className="workflow-step-state" aria-hidden="true">{needsReview ? <AlertCircle size={15} /> : optional ? <small>Optional</small> : null}</span>
          </button>
        </li>;
      })}</ol>
      <div className="workflow-mobile-navigation">
        <button type="button" aria-label="Previous section" disabled={index < 0} onClick={() => onNavigate(index > 0 ? steps[index - 1].id : -1)}><ArrowLeft size={16} aria-hidden="true" /></button>
        <label htmlFor="mobile-step"><span>Jump to section</span><select id="mobile-step" value={current} onChange={event => onNavigate(Number(event.target.value))}>
          <option value={-1}>Draft overview</option>{steps.map((step, i) => <option key={step.id} value={step.id}>{i + 1}. {step.label}</option>)}
        </select></label>
        <button type="button" aria-label="Next section" disabled={index === steps.length - 1} onClick={() => onNavigate(steps[index + 1]?.id ?? steps[0].id)}><ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
  </nav>;
}
