import React from 'react';
import { Trash2, type LucideIcon } from 'lucide-react';
import './icon-button.css';

/** Compact, consistently named controls for familiar row actions. */
export function IconButton({ label, icon: Icon = Trash2, className = '', style, ...props }: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { label: string; icon?: LucideIcon }) {
  return <button {...props} type={props.type || 'button'} className={`dc-icon-button ${className}`} aria-label={label} title={label}
    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 32, minWidth: 32, height: 32, minHeight: 32, padding: 6, ...style }}>
    <Icon size={17} aria-hidden="true" />
  </button>;
}
