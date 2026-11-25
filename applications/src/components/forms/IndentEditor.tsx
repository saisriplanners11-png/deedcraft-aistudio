import React from 'react';
import { IndentFormData, RelationType, STAMP_CATEGORIES } from '../../types/forms';
import {
  DateCalendarField,
  FormSection,
  SelectField,
  TextField,
} from './FormControls';

interface IndentEditorProps {
  data: IndentFormData;
  onChange: (next: IndentFormData) => void;
}

export const IndentEditor: React.FC<IndentEditorProps> = ({ data, onChange }) => {
  const update = <K extends keyof IndentFormData>(key: K, value: IndentFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const computeTotal = (valStr: string, qtyStr: string): string => {
    const val = parseFloat(valStr.replace(/,/g, '').trim());
    const qty = parseFloat(qtyStr.replace(/,/g, '').trim());
    if (Number.isNaN(val) || Number.isNaN(qty)) return '';
    return String(Math.round(val * qty));
  };

  const displayTotal =
    data.totalAmount !== undefined && data.totalAmount.trim() !== ''
      ? data.totalAmount
      : computeTotal(data.valueOfStamps, data.quantity);

  return (
    <div className="space-y-4">
      <FormSection
        title="Stamp Indent Details"
        subtitle="Includes all Registration & Stamps categories (Spl.Adh, Non Judicial, Court fee, etc.)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <TextField
          label="Mobile No."
          value={data.mobileNo}
          onChange={(val) => update('mobileNo', val)}
          placeholder="e.g. 9866270006"
        />
        <SelectField
          label="1. Stamp Category"
          value={data.category}
          onChange={(val) => update('category', val)}
          options={STAMP_CATEGORIES.map((c) => ({
            value: c.code,
            label: `${c.label} (${c.code})`,
          }))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <TextField
          label="2. Value of Stamps (Rs.)"
          value={data.valueOfStamps}
          onChange={(val) =>
            onChange({
              ...data,
              valueOfStamps: val,
              totalAmount: computeTotal(val, data.quantity),
            })
          }
          placeholder="e.g. 1000"
        />
        <TextField
          label="No. of Stamps"
          value={data.quantity}
          onChange={(val) =>
            onChange({
              ...data,
              quantity: val,
              totalAmount: computeTotal(data.valueOfStamps, val),
            })
          }
          placeholder="e.g. 1"
        />
        <TextField
          label="Total (Rs.)"
          value={displayTotal}
          onChange={(val) => update('totalAmount', val)}
          placeholder="Auto-calculated"
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium text-slate-700">
          3. Name of Purchaser with Father Name and Resident
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-[1.38fr_0.64fr_0.93fr_1.05fr] gap-2">
          <TextField
            label="Purchaser Name"
            value={data.purchaserDetails}
            onChange={(val) => update('purchaserDetails', val)}
            placeholder="APPLICANT NAME"
            uppercase
            compact
          />
          <SelectField
            label="S/W/D/O"
            value={data.purchaserRelationType || 'S/O'}
            onChange={(val) =>
              update('purchaserRelationType', val as RelationType)
            }
            options={[
              { value: 'S/O', label: 'S/O' },
              { value: 'W/O', label: 'W/O' },
              { value: 'D/O', label: 'D/O' },
              { value: 'S/W/D/O', label: 'S/W/D/O' },
            ]}
            compact
          />
          <TextField
            label={`${data.purchaserRelationType || 'S/O'} Name`}
            value={data.purchaserRelationLine || ''}
            onChange={(val) => update('purchaserRelationLine', val)}
            placeholder="Optional"
            uppercase
            compact
          />
          <TextField
            label="Residence Address"
            value={data.purchaserResidenceAddress || ''}
            onChange={(val) => update('purchaserResidenceAddress', val)}
            placeholder="e.g. SIRCILLA"
            uppercase
            compact
          />
        </div>
      </div>

      <TextField
        label="4. For Whom with Father Name and Resident"
        value={data.forWhomDetails}
        onChange={(val) => update('forWhomDetails', val)}
        placeholder="SELF or full name, S/O, and resident address"
        multiline
        rows={2}
        uppercase
      />

      <FormSection title="Date & Office Reference" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <DateCalendarField
          label="Application Date"
          value={data.dated}
          onChange={(val) => update('dated', val)}
        />
        <TextField
          label="Indent No. (Optional — usually filled by office)"
          value={data.indentNo}
          onChange={(val) => update('indentNo', val)}
          placeholder="Leave blank for office use"
        />
      </div>
    </div>
  );
};
