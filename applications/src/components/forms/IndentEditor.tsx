import React from 'react';
import { IndentFormData, STAMP_CATEGORIES } from '../../types/forms';
import { FormSection, SelectField, TextField } from './FormControls';

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
        <SelectField
          label="1. Stamp Category"
          value={data.category}
          onChange={(val) => update('category', val)}
          options={STAMP_CATEGORIES.map((c) => ({
            value: c.code,
            label: `${c.label} (${c.code})`,
          }))}
        />
        <TextField
          label="Mobile No."
          value={data.mobileNo}
          onChange={(val) => update('mobileNo', val)}
          placeholder="e.g. 0000000000"
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

      <TextField
        label="3. Name of Purchaser with Father Name and Resident"
        value={data.purchaserDetails}
        onChange={(val) => update('purchaserDetails', val)}
        placeholder="e.g. SAMPLE PURCHASER S/O SAMPLE PARENT R/O SIRCILLA"
        multiline
        rows={2}
        uppercase
      />

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
        <TextField
          label="Dated"
          value={data.dated}
          onChange={(val) => update('dated', val)}
          placeholder="DD/MM/YYYY"
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
