import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EcAgriRow, EcFormData, EcLinkDocument, RelationType } from '../../types/forms';
import { FormSection, SelectField, TextField } from './FormControls';

interface EcEditorProps {
  data: EcFormData;
  onChange: (next: EcFormData) => void;
}

export const EcEditor: React.FC<EcEditorProps> = ({ data, onChange }) => {
  const update = <K extends keyof EcFormData>(key: K, value: EcFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const showAgriculturalLands =
    data.includeAgriculturalLands ??
    Boolean(
      data.agriVillage.trim() ||
        data.agriMandal.trim() ||
        data.agriRows.some((row) => row.syNo.trim() || row.extentAcGs.trim())
    );

  const linkDocs: EcLinkDocument[] =
    data.linkDocuments && data.linkDocuments.length > 0
      ? data.linkDocuments
      : [
          {
            id: 'link-1',
            doctNo: data.doctNo || '',
            doctYear: data.doctYear || '',
            description: '',
          },
        ];

  const syncLinkDocs = (nextDocs: EcLinkDocument[]) => {
    const first = nextDocs[0];
    onChange({
      ...data,
      linkDocuments: nextDocs,
      doctNo: first?.doctNo ?? '',
      doctYear: first?.doctYear ?? '',
    });
  };

  const updateLinkDoc = (index: number, patch: Partial<EcLinkDocument>) => {
    syncLinkDocs(
      linkDocs.map((doc, idx) => (idx === index ? { ...doc, ...patch } : doc))
    );
  };

  const addLinkDoc = () => {
    syncLinkDocs([
      ...linkDocs,
      {
        id: `link-${Date.now()}`,
        doctNo: '',
        doctYear: '',
        description: '',
      },
    ]);
  };

  const removeLinkDoc = (index: number) => {
    if (linkDocs.length <= 1) return;
    syncLinkDocs(linkDocs.filter((_, idx) => idx !== index));
  };

  const updateAgriRow = (index: number, patch: Partial<EcAgriRow>) => {
    update(
      'agriRows',
      data.agriRows.map((row, idx) => (idx === index ? { ...row, ...patch } : row))
    );
  };

  const addAgriRow = () => {
    update('agriRows', [
      ...data.agriRows,
      {
        id: `agri-${Date.now()}`,
        syNo: '',
        extentAcGs: '',
        classification: 'Wet',
      },
    ]);
  };

  const removeAgriRow = (index: number) => {
    if (data.agriRows.length <= 1) return;
    update(
      'agriRows',
      data.agriRows.filter((_, idx) => idx !== index)
    );
  };

  return (
    <div className="space-y-4">
      <FormSection
        title="Applicant Details"
        subtitle="CARD Application for Encumbrance Certificate (E.C.)"
      />

      <div className="grid grid-cols-2 sm:grid-cols-[1.38fr_0.64fr_0.93fr_1.05fr] gap-2">
        <TextField
          label="Name of the Applicant"
          value={data.applicantName}
          onChange={(val) => update('applicantName', val)}
          placeholder="APPLICANT NAME"
          uppercase
          compact
        />
        <SelectField
          label="S/W/D/O"
          value={data.relationType || 'S/O'}
          onChange={(val) => update('relationType', val as RelationType)}
          options={[
            { value: 'S/O', label: 'S/O' },
            { value: 'W/O', label: 'W/O' },
            { value: 'D/O', label: 'D/O' },
            { value: 'S/W/D/O', label: 'S/W/D/O' },
          ]}
          compact
        />
        <TextField
          label={`${data.relationType || 'S/O'} Name`}
          value={data.relationLine || ''}
          onChange={(val) => update('relationLine', val)}
          placeholder="Optional"
          uppercase
          compact
        />
        <TextField
          label="Residence Address"
          value={data.residenceAddress || ''}
          onChange={(val) => update('residenceAddress', val)}
          placeholder="e.g. SIRCILLA"
          uppercase
          compact
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <TextField
          label="Mobile No."
          value={data.mobileNo}
          onChange={(val) => update('mobileNo', val)}
          placeholder="e.g. 0000000000"
        />
      </div>

      <FormSection
        title="Description of Property (House / Open Plot)"
        subtitle="Leave blank if applying strictly for agricultural land"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <TextField
          label="Corporation / Town / Village"
          value={data.corporationTownVillage}
          onChange={(val) => update('corporationTownVillage', val)}
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
          placeholder="Rajanna Sircilla"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <TextField
          label="Door No."
          value={data.doorNo}
          onChange={(val) => update('doorNo', val)}
          placeholder="e.g. 3-7-114"
        />
        <TextField
          label="Plot No."
          value={data.plotNo}
          onChange={(val) => update('plotNo', val)}
          placeholder="e.g. 24"
        />
        <TextField
          label="Survey No."
          value={data.surveyNo}
          onChange={(val) => update('surveyNo', val)}
          placeholder="e.g. 41"
        />
        <TextField
          label="Extent (Sq.y)"
          value={data.extentSqY}
          onChange={(val) => update('extentSqY', val)}
          placeholder="e.g. 144"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <TextField
          label="Name of the Location"
          value={data.locationName}
          onChange={(val) => update('locationName', val)}
          placeholder="e.g. Shanthinagar"
        />
        <TextField
          label="Plinth Area (Sq.ft)"
          value={data.plinthAreaSqFt}
          onChange={(val) => update('plinthAreaSqFt', val)}
          placeholder="e.g. 606"
        />
        <TextField
          label="Name of Apartment"
          value={data.apartmentName}
          onChange={(val) => update('apartmentName', val)}
          placeholder="Optional"
        />
        <TextField
          label="UDS"
          value={data.uds}
          onChange={(val) => update('uds', val)}
          placeholder="Optional"
        />
      </div>

      <div className="flex items-end justify-between pt-4 pb-2 border-b border-slate-200 gap-3">
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showAgriculturalLands}
            onChange={(e) => update('includeAgriculturalLands', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              In Case of Agricultural Lands
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {showAgriculturalLands
                ? 'Add survey numbers, Ac-Gs extent, and classification'
                : 'Select this option to enter agricultural land details'}
            </p>
          </div>
        </label>
        {showAgriculturalLands && (
          <button
            type="button"
            onClick={addAgriRow}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Sy.No
          </button>
        )}
      </div>

      {showAgriculturalLands && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <TextField
              label="Village"
              value={data.agriVillage}
              onChange={(val) => update('agriVillage', val)}
            />
            <TextField
              label="Mandal"
              value={data.agriMandal}
              onChange={(val) => update('agriMandal', val)}
            />
            <TextField
              label="Dist."
              value={data.agriDistrict}
              onChange={(val) => update('agriDistrict', val)}
            />
          </div>

          <div className="space-y-3">
            {data.agriRows.map((row, idx) => (
              <div
                key={row.id}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end rounded-lg border border-slate-200 bg-white p-3"
              >
                <TextField
                  label="Sy.No/s."
                  value={row.syNo}
                  onChange={(val) => updateAgriRow(idx, { syNo: val })}
                  placeholder="e.g. 124/A"
                />
                <TextField
                  label="Extent in Ac-Gs"
                  value={row.extentAcGs}
                  onChange={(val) => updateAgriRow(idx, { extentAcGs: val })}
                  placeholder="e.g. 1-20"
                />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <SelectField
                      label="Classification"
                      value={row.classification}
                      onChange={(val) => updateAgriRow(idx, { classification: val })}
                      options={[
                        { value: 'Wet', label: 'Wet' },
                        { value: 'Dry', label: 'Dry' },
                        { value: 'Irrigated Dry', label: 'Irrigated Dry' },
                        { value: '', label: 'Blank' },
                      ]}
                    />
                  </div>
                  {data.agriRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAgriRow(idx)}
                      aria-label="Remove row"
                      className="mb-1 rounded-md p-2 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {data.agriRows.length >= 3 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addAgriRow}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Another Sy.No ({data.agriRows.length})
              </button>
            </div>
          )}
        </>
      )}

      <FormSection title="Boundaries, Link Documents & Search Period" />

      <TextField
        label="Property Belongs To (Smt./Sri)"
        value={data.belongsTo}
        onChange={(val) => update('belongsTo', val)}
        placeholder="SELF"
        uppercase
      />

      {/* Multiple Link Documents */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-800">
              Document &amp; Link Documents ({linkDocs.length})
            </div>
            <div className="text-[11px] text-slate-500">
              Add primary document and any prior link document numbers
            </div>
          </div>
          <button
            type="button"
            onClick={addLinkDoc}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Link Doc
          </button>
        </div>

        <div className="space-y-2.5">
          {linkDocs.map((doc, idx) => (
            <div
              key={doc.id}
              className="grid grid-cols-12 gap-2.5 items-end rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="col-span-6">
                <TextField
                  label={idx === 0 ? 'Doct. No.' : `Link ${idx} No.`}
                  value={doc.doctNo}
                  onChange={(val) => updateLinkDoc(idx, { doctNo: val })}
                  placeholder="e.g. 3789"
                />
              </div>
              <div className="col-span-6 flex items-end gap-2">
                <div className="flex-1">
                  <TextField
                    label="Year"
                    value={doc.doctYear}
                    onChange={(val) => updateLinkDoc(idx, { doctYear: val })}
                    placeholder="e.g. 2012"
                  />
                </div>
                {linkDocs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLinkDoc(idx)}
                    aria-label={`Remove link document ${idx + 1}`}
                    className="mb-1 rounded-md p-2 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <TextField
          label="North Boundary"
          value={data.north}
          onChange={(val) => update('north', val)}
        />
        <TextField
          label="South Boundary"
          value={data.south}
          onChange={(val) => update('south', val)}
        />
        <TextField
          label="East Boundary"
          value={data.east}
          onChange={(val) => update('east', val)}
        />
        <TextField
          label="West Boundary"
          value={data.west}
          onChange={(val) => update('west', val)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <TextField
          label="Period of Search From"
          value={data.periodFrom}
          onChange={(val) => update('periodFrom', val)}
          placeholder="e.g. 01/01/1983"
        />
        <TextField
          label="Period of Search To"
          value={data.periodTo}
          onChange={(val) => update('periodTo', val)}
          placeholder="DD/MM/YYYY"
        />
        <TextField
          label="Application Date"
          value={data.date}
          onChange={(val) => update('date', val)}
          placeholder="DD/MM/YYYY"
        />
      </div>
    </div>
  );
};
