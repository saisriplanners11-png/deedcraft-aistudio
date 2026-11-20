import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  HOUSE_NO_LABEL_OPTIONS,
  HouseNoLabelType,
  MvHouseFormData,
  MvHouseRow,
  MvOpenFormData,
  MvOpenRow,
} from '../../types/forms';
import { FormSection, SelectField, TextField } from './FormControls';

export type MarketValueMode = 'mvOpen' | 'mvHouse';

interface MarketValueEditorProps {
  mode: MarketValueMode;
  onModeChange: (nextMode: MarketValueMode) => void;
  mvOpen: MvOpenFormData;
  mvHouse: MvHouseFormData;
  onChangeOpen: (next: MvOpenFormData) => void;
  onChangeHouse: (next: MvHouseFormData) => void;
}

export const MarketValueEditor: React.FC<MarketValueEditorProps> = ({
  mode,
  onModeChange,
  mvOpen,
  mvHouse,
  onChangeOpen,
  onChangeHouse,
}) => {
  const isHouse = mode === 'mvHouse';

  const activeCommon = isHouse ? mvHouse : mvOpen;

  const updateCommon = (
    patch: Partial<
      Pick<
        MvOpenFormData,
        | 'mobileNo'
        | 'village'
        | 'mandal'
        | 'district'
        | 'courtName'
        | 'plaintiffNameAddress'
        | 'applicantNameAddress'
        | 'place'
        | 'date'
      >
    >
  ) => {
    if (isHouse) {
      onChangeHouse({ ...mvHouse, ...patch });
    } else {
      onChangeOpen({ ...mvOpen, ...patch });
    }
  };

  const handleModeSelect = (nextMode: MarketValueMode) => {
    if (nextMode === mode) return;

    if (nextMode === 'mvHouse') {
      const composedSituated = [
        mvOpen.situatedLocality.trim(),
        mvOpen.situatedMandal.trim(),
        mvOpen.situatedDistrict.trim()
          ? `Dist.${mvOpen.situatedDistrict.trim()}`
          : '',
      ]
        .filter(Boolean)
        .join(', ');

      const firstOpenRow = mvOpen.rows[0];
      const firstHouseRow = mvHouse.rows[0];
      const shouldCopyRow =
        firstOpenRow &&
        firstHouseRow &&
        !firstHouseRow.syNo.trim() &&
        !firstHouseRow.bearingHNo.trim() &&
        !firstHouseRow.rccSqFts.trim();

      onChangeHouse({
        ...mvHouse,
        mobileNo: mvOpen.mobileNo,
        village: mvOpen.village,
        mandal: mvOpen.mandal,
        district: mvOpen.district,
        courtName: mvOpen.courtName,
        plaintiffNameAddress: mvOpen.plaintiffNameAddress,
        applicantNameAddress: mvOpen.applicantNameAddress,
        place: mvOpen.place,
        date: mvOpen.date,
        situatedText: mvHouse.situatedText.trim()
          ? mvHouse.situatedText
          : composedSituated || mvHouse.situatedText,
        rows: shouldCopyRow
          ? [
              {
                ...firstHouseRow,
                syNo: firstOpenRow.syNo,
                plotNo: firstOpenRow.plotNo,
                extentSqY: firstOpenRow.extentSqY,
                wardBlockNo: firstOpenRow.wardBlockNo,
                bearingHNo: firstOpenRow.nearHNo,
                total: firstOpenRow.total,
              },
              ...mvHouse.rows.slice(1),
            ]
          : mvHouse.rows,
      });
    } else {
      const firstHouseRow = mvHouse.rows[0];
      const firstOpenRow = mvOpen.rows[0];
      const shouldCopyRow =
        firstHouseRow &&
        firstOpenRow &&
        !firstOpenRow.syNo.trim() &&
        !firstOpenRow.nearHNo.trim() &&
        !firstOpenRow.valuePerSqY.trim();

      onChangeOpen({
        ...mvOpen,
        mobileNo: mvHouse.mobileNo,
        village: mvHouse.village,
        mandal: mvHouse.mandal,
        district: mvHouse.district,
        courtName: mvHouse.courtName,
        plaintiffNameAddress: mvHouse.plaintiffNameAddress,
        applicantNameAddress: mvHouse.applicantNameAddress,
        place: mvHouse.place,
        date: mvHouse.date,
        situatedMandal: mvOpen.situatedMandal || mvHouse.mandal,
        situatedDistrict: mvOpen.situatedDistrict || mvHouse.district,
        rows: shouldCopyRow
          ? [
              {
                ...firstOpenRow,
                syNo: firstHouseRow.syNo,
                plotNo: firstHouseRow.plotNo,
                extentSqY: firstHouseRow.extentSqY,
                wardBlockNo: firstHouseRow.wardBlockNo,
                nearHNo: firstHouseRow.bearingHNo,
                total: firstHouseRow.total,
              },
              ...mvOpen.rows.slice(1),
            ]
          : mvOpen.rows,
      });
    }

    onModeChange(nextMode);
  };

  // Open Plot Row Helpers
  const updateOpenRow = (index: number, patch: Partial<MvOpenRow>) => {
    const nextRows = mvOpen.rows.map((row, idx) => {
      if (idx !== index) return row;
      const merged = { ...row, ...patch };
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
    onChangeOpen({ ...mvOpen, rows: nextRows });
  };

  const addOpenRow = () => {
    onChangeOpen({
      ...mvOpen,
      rows: [
        ...mvOpen.rows,
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
      ],
    });
  };

  const removeOpenRow = (index: number) => {
    if (mvOpen.rows.length <= 1) return;
    onChangeOpen({
      ...mvOpen,
      rows: mvOpen.rows.filter((_, idx) => idx !== index),
    });
  };

  // House Row Helpers
  const updateHouseRow = (index: number, patch: Partial<MvHouseRow>) => {
    onChangeHouse({
      ...mvHouse,
      rows: mvHouse.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    });
  };

  const addHouseRow = () => {
    onChangeHouse({
      ...mvHouse,
      rows: [
        ...mvHouse.rows,
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
      ],
    });
  };

  const removeHouseRow = (index: number) => {
    if (mvHouse.rows.length <= 1) return;
    onChangeHouse({
      ...mvHouse,
      rows: mvHouse.rows.filter((_, idx) => idx !== index),
    });
  };

  return (
    <div className="space-y-4">
      <FormSection
        title="Header & Jurisdiction"
        subtitle="Annexure-I Market Value Certificate — Select Vacant Plot or Residential"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <SelectField
          label="Property Type"
          value={mode}
          onChange={(val) => handleModeSelect(val as MarketValueMode)}
          options={[
            { value: 'mvOpen', label: 'VACANT PLOT' },
            { value: 'mvHouse', label: 'RESIDENTIAL' },
          ]}
        />
        <TextField
          label="Mobile No."
          value={activeCommon.mobileNo}
          onChange={(val) => updateCommon({ mobileNo: val })}
          placeholder="10-digit mobile number"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <TextField
          label="1. Name of the Village"
          value={activeCommon.village}
          onChange={(val) => updateCommon({ village: val })}
          placeholder="e.g. Sircilla"
        />
        <TextField
          label="Mandal"
          value={activeCommon.mandal}
          onChange={(val) => updateCommon({ mandal: val })}
          placeholder="e.g. Sircilla"
        />
        <TextField
          label="District"
          value={activeCommon.district}
          onChange={(val) => updateCommon({ district: val })}
          placeholder="Rajanna Sircilla."
        />
      </div>

      <TextField
        label="2. Name of the Court where the suit is proposed to be filed"
        value={activeCommon.courtName}
        onChange={(val) => updateCommon({ courtName: val })}
        placeholder="Junior Civil Judge, Sircilla."
      />

      {!isHouse ? (
        <>
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
              onClick={addOpenRow}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>
          </div>

          <div className="space-y-4">
            {mvOpen.rows.map((row, idx) => (
              <div
                key={row.id}
                className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Property Row {idx + 1}
                  </span>
                  {mvOpen.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOpenRow(idx)}
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
                    onChange={(val) => updateOpenRow(idx, { syNo: val })}
                    placeholder="e.g. 142"
                  />
                  <TextField
                    label="Plot.No/s."
                    value={row.plotNo}
                    onChange={(val) => updateOpenRow(idx, { plotNo: val })}
                    placeholder="e.g. 24"
                  />
                  <TextField
                    label="Extent (in Sq.y)"
                    value={row.extentSqY}
                    onChange={(val) => updateOpenRow(idx, { extentSqY: val })}
                    placeholder="e.g. 200"
                  />
                  <SelectField
                    label="H.No. Type"
                    value={row.nearHNoLabel || 'Near H.No.'}
                    onChange={(val) =>
                      updateOpenRow(idx, {
                        nearHNoLabel: val as HouseNoLabelType,
                      })
                    }
                    options={HOUSE_NO_LABEL_OPTIONS.map((opt) => ({
                      value: opt,
                      label: opt,
                    }))}
                  />
                  <TextField
                    label={row.nearHNoLabel || 'Near H.No.'}
                    value={row.nearHNo}
                    onChange={(val) => updateOpenRow(idx, { nearHNo: val })}
                    placeholder="e.g. 5-2-118"
                  />
                  <SelectField
                    label="Zone"
                    value={row.zone}
                    onChange={(val) => updateOpenRow(idx, { zone: val })}
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
                    onChange={(val) => updateOpenRow(idx, { valuePerSqY: val })}
                    placeholder="e.g. 6500"
                  />
                  <TextField
                    label="Total Value"
                    value={row.total}
                    onChange={(val) => updateOpenRow(idx, { total: val })}
                    placeholder="Auto or manual"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <TextField
              label="Situated at (Locality)"
              value={mvOpen.situatedLocality}
              onChange={(val) =>
                onChangeOpen({ ...mvOpen, situatedLocality: val })
              }
              placeholder="e.g. Vidyanagar"
            />
            <TextField
              label="Situated Mandal / Town"
              value={mvOpen.situatedMandal}
              onChange={(val) =>
                onChangeOpen({ ...mvOpen, situatedMandal: val })
              }
              placeholder="e.g. Sircilla"
            />
            <TextField
              label="Situated District"
              value={mvOpen.situatedDistrict}
              onChange={(val) =>
                onChangeOpen({ ...mvOpen, situatedDistrict: val })
              }
              placeholder="Rajanna Sircilla."
            />
          </div>
        </>
      ) : (
        <>
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
              onClick={addHouseRow}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </button>
          </div>

          <div className="space-y-4">
            {mvHouse.rows.map((row, idx) => (
              <div
                key={row.id}
                className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    House Entry {idx + 1}
                  </span>
                  {mvHouse.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeHouseRow(idx)}
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
                    onChange={(val) => updateHouseRow(idx, { syNo: val })}
                    placeholder="e.g. 41"
                  />
                  <TextField
                    label="Plot.No/s."
                    value={row.plotNo}
                    onChange={(val) => updateHouseRow(idx, { plotNo: val })}
                    placeholder="Optional"
                  />
                  <TextField
                    label="Extent (in Sq.y)"
                    value={row.extentSqY}
                    onChange={(val) => updateHouseRow(idx, { extentSqY: val })}
                    placeholder="e.g. 144"
                  />
                  <TextField
                    label="Bearing H.No."
                    value={row.bearingHNo}
                    onChange={(val) => updateHouseRow(idx, { bearingHNo: val })}
                    placeholder="e.g. 3-7-114"
                  />
                  <TextField
                    label="Total (Optional)"
                    value={row.total}
                    onChange={(val) => updateHouseRow(idx, { total: val })}
                    placeholder="Optional"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <TextField
                    label="R.C.C. (Sq.fts)"
                    value={row.rccSqFts}
                    onChange={(val) => updateHouseRow(idx, { rccSqFts: val })}
                    placeholder="e.g. 486"
                  />
                  <TextField
                    label="TINSHED. (Sq.fts)"
                    value={row.tinshedSqFts}
                    onChange={(val) =>
                      updateHouseRow(idx, { tinshedSqFts: val })
                    }
                    placeholder="e.g. 120"
                  />
                  <TextField
                    label="B.TILES (Sq.fts)"
                    value={row.bTilesSqFts}
                    onChange={(val) => updateHouseRow(idx, { bTilesSqFts: val })}
                    placeholder="Optional"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextField
                    label="Additional Roof Type (Optional)"
                    value={row.customRoofLabel}
                    onChange={(val) =>
                      updateHouseRow(idx, { customRoofLabel: val })
                    }
                    placeholder="e.g. FIRST FLOOR R.C.C."
                  />
                  <TextField
                    label="Additional Roof Sq.fts"
                    value={row.customRoofSqFts}
                    onChange={(val) =>
                      updateHouseRow(idx, { customRoofSqFts: val })
                    }
                    placeholder="e.g. 400"
                  />
                </div>
              </div>
            ))}
          </div>

          <TextField
            label="Situated at (Locality, Mandal, District)"
            value={mvHouse.situatedText}
            onChange={(val) =>
              onChangeHouse({ ...mvHouse, situatedText: val })
            }
            placeholder="e.g. Shanthinagar, Sircilla, Dist.Rajanna Sircilla."
          />
        </>
      )}

      <FormSection title="Plaintiff & Applicant Details" />

      <TextField
        label="4. Name and full address of the Plaintiff to the suit"
        value={activeCommon.plaintiffNameAddress}
        onChange={(val) => updateCommon({ plaintiffNameAddress: val })}
        placeholder="Full name, S/O or W/O, and residential address"
        multiline
        rows={2}
      />

      <TextField
        label="5. Name and full address of the Applicant (if other than Plaintiff)"
        value={activeCommon.applicantNameAddress}
        onChange={(val) => updateCommon({ applicantNameAddress: val })}
        placeholder="Leave blank if Applicant is the Plaintiff"
        multiline
        rows={2}
      />

      <div className="grid grid-cols-2 gap-3.5">
        <TextField
          label="Place"
          value={activeCommon.place}
          onChange={(val) => updateCommon({ place: val })}
          placeholder="Sircilla."
        />
        <TextField
          label="Date"
          value={activeCommon.date}
          onChange={(val) => updateCommon({ date: val })}
          placeholder="DD/MM/YYYY"
        />
      </div>
    </div>
  );
};
