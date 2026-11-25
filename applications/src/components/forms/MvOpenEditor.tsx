import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  HOUSE_NO_LABEL_OPTIONS,
  HouseNoLabelType,
  MvOpenFormData,
  MvOpenRow,
  RelationType,
} from '../../types/forms';
import {
  DateCalendarField,
  FormSection,
  SelectField,
  TextField,
} from './FormControls';

interface MvOpenEditorProps {
  data: MvOpenFormData;
  onChange: (next: MvOpenFormData) => void;
}

export const MvOpenEditor: React.FC<MvOpenEditorProps> = ({ data, onChange }) => {
  const update = <K extends keyof MvOpenFormData>(key: K, value: MvOpenFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const updateRow = (index: number, patch: Partial<MvOpenRow>) => {
    const nextRows = data.rows.map((row, idx) => {
      if (idx !== index) return row;
      const merged = { ...row, ...patch };
      // Auto-calculate total if extent and valuePerSqY are numeric and user didn't directly edit total
      if (
        ('extentSqY' in patch || 'valuePerSqY' in patch) &&
        !('total' in patch)
      ) {
        const ext = parseFloat(merged.extentSqY.replace(/,/g, ''));
        const rate = parseFloat(merged.valuePerSqY.replace(/,/g, ''));
        if (!Number.isNaN(ext) && !Number.isNaN(rate)) {
          merged.total = Math.round(ext * rate).toLocaleString('en-IN');
        }
      }
      return merged;
    });
    update('rows', nextRows);
  };

  const addRow = () => {
    update('rows', [
      ...data.rows,
      {
        id: `row-${Date.now()}`,
        syNo: '',
        plotNo: '',
        extentSqY: '',
        wardBlockNo: '',
        nearHNoLabel: 'Near H.No.',
        nearHNo: '',
        zone: '',
        valuePerSqY: '',
        total: '',
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (data.rows.length <= 1) return;
    update(
      'rows',
      data.rows.filter((_, idx) => idx !== index)
    );
  };

  return (
    <div className="space-y-4">
      <FormSection
        title="Header & Jurisdiction"
        subtitle="Annexure-I Market Value Certificate for Open Plot / House Site"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <TextField
          label="Mobile No."
          value={data.mobileNo}
          onChange={(val) => update('mobileNo', val)}
          placeholder="e.g. 9866255720"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <TextField
          label="1. Name of the Village"
          value={data.village}
          onChange={(val) => update('village', val)}
          placeholder="e.g. Sircilla"
        />
        <TextField
          label="Mandal"
          value={data.mandal}
          onChange={(val) => update('mandal', val)}
          placeholder="e.g. Sircilla"
        />
        <TextField
          label="District"
          value={data.district}
          onChange={(val) => update('district', val)}
          placeholder="Rajanna Sircilla."
        />
      </div>

      <TextField
        label="2. Name of the Court where the suit is proposed to be filed"
        value={data.courtName}
        onChange={(val) => update('courtName', val)}
        placeholder="Junior Civil Judge, Sircilla."
      />

      <div className="flex items-end justify-between pt-4 pb-2 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            3. House Sites Schedule
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Total auto-calculates when Extent and Value per Sq.y are numbers
          </p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Row
        </button>
      </div>

      <div className="space-y-4">
        {data.rows.map((row, idx) => (
          <div
            key={row.id}
            className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Property Row {idx + 1}
              </span>
              {data.rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <TextField
                label="Sy.No/s."
                value={row.syNo}
                onChange={(val) => updateRow(idx, { syNo: val })}
                placeholder="e.g. 142"
              />
              <TextField
                label="Plot.No/s."
                value={row.plotNo}
                onChange={(val) => updateRow(idx, { plotNo: val })}
                placeholder="e.g. 24"
              />
              <TextField
                label="Extent (in Sq.y)"
                value={row.extentSqY}
                onChange={(val) => updateRow(idx, { extentSqY: val })}
                placeholder="e.g. 200"
              />
              <SelectField
                label="H.No. Type"
                value={row.nearHNoLabel || 'Near H.No.'}
                onChange={(val) =>
                  updateRow(idx, { nearHNoLabel: val as HouseNoLabelType })
                }
                options={HOUSE_NO_LABEL_OPTIONS.map((opt) => ({
                  value: opt,
                  label: opt,
                }))}
              />
              <TextField
                label={row.nearHNoLabel || 'Near H.No.'}
                value={row.nearHNo}
                onChange={(val) => updateRow(idx, { nearHNo: val })}
                placeholder="e.g. 5-2-118"
              />
              <SelectField
                label="Zone"
                value={row.zone}
                onChange={(val) => updateRow(idx, { zone: val })}
                options={[
                  { value: '', label: 'Select Zone (optional)' },
                  { value: 'Residential', label: 'Residential' },
                  { value: 'Commercial', label: 'Commercial' },
                  { value: 'Semi-Commercial', label: 'Semi-Commercial' },
                  { value: 'Industrial', label: 'Industrial' },
                ]}
              />
              <TextField
                label="Value per Sq.y"
                value={row.valuePerSqY}
                onChange={(val) => updateRow(idx, { valuePerSqY: val })}
                placeholder="e.g. 6500"
              />
              <TextField
                label="Total Value"
                value={row.total}
                onChange={(val) => updateRow(idx, { total: val })}
                placeholder="Auto or manual"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <TextField
          label="Situated at (Locality)"
          value={data.situatedLocality}
          onChange={(val) => update('situatedLocality', val)}
          placeholder="e.g. Vidyanagar"
        />
        <TextField
          label="Situated Mandal / Town"
          value={data.situatedMandal}
          onChange={(val) => update('situatedMandal', val)}
          placeholder="e.g. Sircilla"
        />
        <TextField
          label="Situated District"
          value={data.situatedDistrict}
          onChange={(val) => update('situatedDistrict', val)}
          placeholder="Rajanna Sircilla."
        />
      </div>

      <FormSection title="Plaintiff & Applicant Details" />

      <div className="space-y-1.5">
        <div className="text-xs font-medium text-slate-700">
          4. Name and full address of the Plaintiff to the suit
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-[1.38fr_0.64fr_0.93fr_1.05fr] gap-2">
          <TextField
            label="Plaintiff Name"
            value={data.plaintiffNameAddress}
            onChange={(val) => update('plaintiffNameAddress', val)}
            placeholder="PLAINTIFF NAME"
            uppercase
            compact
          />
          <SelectField
            label="S/W/D/O"
            value={data.plaintiffRelationType || 'S/O'}
            onChange={(val) =>
              update('plaintiffRelationType', val as RelationType)
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
            label={`${data.plaintiffRelationType || 'S/O'} Name`}
            value={data.plaintiffRelationLine || ''}
            onChange={(val) => update('plaintiffRelationLine', val)}
            placeholder="Optional"
            uppercase
            compact
          />
          <TextField
            label="Residence Address"
            value={data.plaintiffResidenceAddress || ''}
            onChange={(val) => update('plaintiffResidenceAddress', val)}
            placeholder="e.g. SIRCILLA"
            uppercase
            compact
          />
        </div>
      </div>

      <TextField
        label="5. Name and full address of the Applicant (if other than Plaintiff)"
        value={data.applicantNameAddress}
        onChange={(val) => update('applicantNameAddress', val)}
        placeholder="Leave blank if Applicant is the Plaintiff"
        multiline
        rows={2}
      />

      <div className="grid grid-cols-2 gap-3.5">
        <TextField
          label="Place"
          value={data.place}
          onChange={(val) => update('place', val)}
          placeholder="Sircilla."
        />
        <DateCalendarField
          label="Application Date"
          value={data.date}
          onChange={(val) => update('date', val)}
        />
      </div>
    </div>
  );
};
