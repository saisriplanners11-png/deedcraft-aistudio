import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { MvHouseFormData, MvHouseRow, RelationType } from '../../types/forms';
import {
  DateCalendarField,
  FormSection,
  SelectField,
  TextField,
} from './FormControls';

interface MvHouseEditorProps {
  data: MvHouseFormData;
  onChange: (next: MvHouseFormData) => void;
}

export const MvHouseEditor: React.FC<MvHouseEditorProps> = ({ data, onChange }) => {
  const update = <K extends keyof MvHouseFormData>(key: K, value: MvHouseFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const updateRow = (index: number, patch: Partial<MvHouseRow>) => {
    update(
      'rows',
      data.rows.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const addRow = () => {
    update('rows', [
      ...data.rows,
      {
        id: `hrow-${Date.now()}`,
        syNo: '',
        plotNo: '',
        extentSqY: '',
        wardBlockNo: '',
        bearingHNo: '',
        rccSqFts: '',
        tinshedSqFts: '',
        bTilesSqFts: '',
        customRoofLabel: '',
        customRoofSqFts: '',
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
        subtitle="Annexure-I Market Value Certificate for House / Building with Plinth Area"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <TextField
          label="Mobile No."
          value={data.mobileNo}
          onChange={(val) => update('mobileNo', val)}
          placeholder="e.g. 9000782299"
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
            3. House &amp; Plinth Area Schedule
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter R.C.C., TINSHED, and B.TILES plinth areas in Sq.fts
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
                House Entry {idx + 1}
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
                placeholder="e.g. 41"
              />
              <TextField
                label="Plot.No/s."
                value={row.plotNo}
                onChange={(val) => updateRow(idx, { plotNo: val })}
                placeholder="Optional"
              />
              <TextField
                label="Extent (in Sq.y)"
                value={row.extentSqY}
                onChange={(val) => updateRow(idx, { extentSqY: val })}
                placeholder="e.g. 144"
              />
              <TextField
                label="Bearing H.No."
                value={row.bearingHNo}
                onChange={(val) => updateRow(idx, { bearingHNo: val })}
                placeholder="e.g. 3-7-114"
              />
              <TextField
                label="Total (Optional)"
                value={row.total}
                onChange={(val) => updateRow(idx, { total: val })}
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <TextField
                label="R.C.C. (Sq.fts)"
                value={row.rccSqFts}
                onChange={(val) => updateRow(idx, { rccSqFts: val })}
                placeholder="e.g. 486"
              />
              <TextField
                label="TINSHED. (Sq.fts)"
                value={row.tinshedSqFts}
                onChange={(val) => updateRow(idx, { tinshedSqFts: val })}
                placeholder="e.g. 120"
              />
              <TextField
                label="B.TILES (Sq.fts)"
                value={row.bTilesSqFts}
                onChange={(val) => updateRow(idx, { bTilesSqFts: val })}
                placeholder="Optional"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Additional Roof Type (Optional)"
                value={row.customRoofLabel}
                onChange={(val) => updateRow(idx, { customRoofLabel: val })}
                placeholder="e.g. FIRST FLOOR R.C.C."
              />
              <TextField
                label="Additional Roof Sq.fts"
                value={row.customRoofSqFts}
                onChange={(val) => updateRow(idx, { customRoofSqFts: val })}
                placeholder="e.g. 400"
              />
            </div>
          </div>
        ))}
      </div>

      <TextField
        label="Situated at (Locality, Mandal, District)"
        value={data.situatedText}
        onChange={(val) => update('situatedText', val)}
        placeholder="e.g. Shanthinagar, Sircilla, Dist.Rajanna Sircilla."
      />

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
