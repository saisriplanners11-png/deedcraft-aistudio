import React from 'react';

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  uppercase?: boolean;
  type?: string;
  compact?: boolean;
}

export const TextField: React.FC<FieldProps> = ({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  hint,
  multiline = false,
  rows = 2,
  uppercase = false,
  type = 'text',
  compact = false,
}) => {
  const handleChange = (val: string) => {
    onChange(uppercase ? val.toUpperCase() : val);
  };

  const baseClass = `w-full rounded-md border border-slate-300 bg-white ${
    compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
  } text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors`;

  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`text-xs font-medium text-slate-700 ${
            compact ? 'whitespace-nowrap' : ''
          }`}
        >
          {label}
        </span>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={`${baseClass} resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={baseClass}
        />
      )}
    </label>
  );
};

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  hint?: string;
  compact?: boolean;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  onChange,
  options,
  hint,
  compact = false,
}) => {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`text-xs font-medium text-slate-700 ${
            compact ? 'whitespace-nowrap' : ''
          }`}
        >
          {label}
        </span>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-md border border-slate-300 bg-white ${
          compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        } text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
};

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
}

export const FormSection: React.FC<SectionHeadingProps> = ({ title, subtitle }) => (
  <div className="pt-4 pb-2 border-b border-slate-200">
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
  </div>
);

interface DateCalendarFieldProps {
  label: string;
  value: string;
  onChange: (ddmmyyyy: string) => void;
  hint?: string;
}

function toIsoDateValue(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const compact = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) {
    return `${compact[3]}-${compact[2]}-${compact[1]}`;
  }
  return '';
}

function fromIsoDateValue(iso: string): string {
  const trimmed = (iso || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return trimmed;
}

export const DateCalendarField: React.FC<DateCalendarFieldProps> = ({
  label,
  value,
  onChange,
  hint,
}) => {
  const isoValue = toIsoDateValue(value);
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      <input
        type="date"
        value={isoValue}
        onChange={(e) => onChange(fromIsoDateValue(e.target.value))}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors"
      />
    </label>
  );
};
