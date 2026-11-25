import React, { useState } from 'react';
import {
  CcApplicationMode,
  CcCopyFormData,
  REGISTERED_DEED_TYPES,
  RelationType,
  TELANGANA_SRO_LIST,
} from '../../types/forms';
import { FormSection, SelectField, TextField } from './FormControls';

interface CcCopyEditorProps {
  data: CcCopyFormData;
  onChange: (next: CcCopyFormData) => void;
}

function parseDocNoYear(value: string): {
  doctNo: string;
  year: string;
  hasSeparator: boolean;
} {
  const cleaned = value.trim().replace(/^no\.?\s*/i, '');
  if (!cleaned) return { doctNo: '', year: '', hasSeparator: false };

  const sepMatch = cleaned.match(/^([^\s/-]+)\s*[/-]\s*(\d{0,4})$/);
  if (sepMatch) {
    return {
      doctNo: sepMatch[1],
      year: sepMatch[2],
      hasSeparator: true,
    };
  }

  return { doctNo: cleaned, year: '', hasSeparator: false };
}

function extractDocNoYearFromText(
  text: string
): { doctNo: string; year: string } | null {
  const match = text.match(/(?:no\.?\s*)?(\d+[a-zA-Z0-9]*)\s*[/-]\s*(\d{4})\b/i);
  if (!match) return null;
  return { doctNo: match[1], year: match[2] };
}

export const CcCopyEditor: React.FC<CcCopyEditorProps> = ({ data, onChange }) => {
  const [customDeedMode, setCustomDeedMode] = useState(false);
  const [customSroMode, setCustomSroMode] = useState(false);

  const update = <K extends keyof CcCopyFormData>(key: K, value: CcCopyFormData[K]) => {
    onChange({ ...data, [key]: value });
  };

  const handleDocumentNoChange = (val: string) => {
    const prevParsed = parseDocNoYear(data.documentNo || '');
    const nextParsed = parseDocNoYear(val);
    const patch: Partial<CcCopyFormData> = {
      documentNo: val,
      doctNo: nextParsed.doctNo,
    };

    if (nextParsed.hasSeparator) {
      patch.year = nextParsed.year;
      if (
        nextParsed.year.length === 4 ||
        !data.searchYear ||
        data.searchYear === prevParsed.year
      ) {
        patch.searchYear = nextParsed.year;
      }
    } else if (!val.trim() || prevParsed.hasSeparator) {
      patch.year = '';
      if (prevParsed.year && data.searchYear === prevParsed.year) {
        patch.searchYear = '';
      }
    }

    onChange({ ...data, ...patch });
  };

  const handleCustomDescriptionChange = (val: string) => {
    const patch: Partial<CcCopyFormData> = { descriptionOfDocument: val };
    if (!(data.documentNo || '').trim()) {
      const extracted = extractDocNoYearFromText(val);
      if (extracted) {
        patch.doctNo = extracted.doctNo;
        patch.year = extracted.year;
        patch.searchYear = extracted.year;
      }
    }
    onChange({ ...data, ...patch });
  };

  const baseBooks = ['1', '3', '4'];
  const rawBookNo = data.bookNo.trim();
  const currentBook = rawBookNo === '2' ? '1' : rawBookNo;
  const bookValues =
    currentBook && !baseBooks.includes(currentBook)
      ? [...baseBooks, currentBook]
      : baseBooks;
  const currentDocBook = (data.documentBookNo || '').trim();
  const normalizedDocBook = currentDocBook === '2' ? '' : currentDocBook;

  return (
    <div className="space-y-4">
      <FormSection
        title="Application Header & Applicant"
        subtitle="Switch between Certified Copy and Personal Search formats"
      />

      <div className="grid grid-cols-1 sm:grid-cols-[0.85fr_1.3fr_1fr] gap-2.5">
        <TextField
          label="Mobile No."
          value={data.mobileNo}
          onChange={(val) => update('mobileNo', val)}
          placeholder="e.g. 9866255720"
          compact
        />
        <SelectField
          label="Application Type"
          value={data.applicationType}
          onChange={(val) => update('applicationType', val as CcApplicationMode)}
          options={[
            { value: 'CERTIFIED COPY', label: 'CERTIFIED COPY APPLICATION' },
            { value: 'PERSONAL SEARCH', label: 'PERSONAL SEARCH APPLICATION' },
          ]}
          compact
        />
        {(() => {
          const rawSro = data.toOffice.trim();
          const normalizedSro = rawSro.replace(/\.$/, '').trim().toUpperCase();
          const isPresetSro =
            normalizedSro === '' || TELANGANA_SRO_LIST.includes(normalizedSro);
          const showCustomSro = customSroMode || !isPresetSro;
          const sroSelectValue = showCustomSro
            ? '__custom__'
            : normalizedSro || 'SIRCILLA';

          return (
            <SelectField
              label="To — SRO"
              value={sroSelectValue}
              onChange={(val) => {
                if (val === '__custom__') {
                  setCustomSroMode(true);
                  if (
                    normalizedSro === '' ||
                    TELANGANA_SRO_LIST.includes(normalizedSro)
                  ) {
                    update('toOffice', '');
                  }
                } else {
                  setCustomSroMode(false);
                  update('toOffice', val);
                }
              }}
              options={[
                ...TELANGANA_SRO_LIST.map((sro) => ({
                  value: sro,
                  label: sro,
                })),
                { value: '__custom__', label: 'OTHER / CUSTOM SRO...' },
              ]}
              compact
            />
          );
        })()}
      </div>

      {(() => {
        const normalizedSro = data.toOffice
          .trim()
          .replace(/\.$/, '')
          .trim()
          .toUpperCase();
        const isPresetSro =
          normalizedSro === '' || TELANGANA_SRO_LIST.includes(normalizedSro);
        if (!customSroMode && isPresetSro) return null;
        return (
          <TextField
            label="Custom SRO Office Name"
            value={data.toOffice}
            onChange={(val) => update('toOffice', val)}
            placeholder="ENTER SUB-REGISTRAR OFFICE NAME"
            uppercase
          />
        );
      })()}

      <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={data.showCardSubtitle}
          onChange={(e) => update('showCardSubtitle', e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
        <span>Include CARD official subtitle &amp; portal URL in header</span>
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-[1.38fr_0.64fr_0.93fr_1.05fr] gap-2">
        <TextField
          label="From — Name & Address"
          value={data.fromNameAddress}
          onChange={(val) => update('fromNameAddress', val)}
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
          value={data.relationLine}
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

      <FormSection
        title="Document Search Particulars (Items 1–6)"
        subtitle="Details printed in the main numbered list"
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_0.75fr] gap-3 items-start">
        <div className="space-y-2">
          {(() => {
            const currentDesc = data.descriptionOfDocument.trim();
            const upperDesc = currentDesc.toUpperCase();
            const isPreset =
              currentDesc === '' || REGISTERED_DEED_TYPES.includes(upperDesc);
            const showCustomInput = customDeedMode || !isPreset;
            const selectValue = showCustomInput
              ? '__custom__'
              : currentDesc === ''
              ? ''
              : upperDesc;

            return (
              <>
                <SelectField
                  label="1. Description of Document"
                  value={selectValue}
                  onChange={(val) => {
                    if (val === '__custom__') {
                      setCustomDeedMode(true);
                      if (REGISTERED_DEED_TYPES.includes(upperDesc)) {
                        update('descriptionOfDocument', '');
                      }
                    } else {
                      setCustomDeedMode(false);
                      update('descriptionOfDocument', val);
                    }
                  }}
                  options={[
                    { value: '', label: '-- SELECT REGISTERED DEED TYPE --' },
                    ...REGISTERED_DEED_TYPES.map((deed) => ({
                      value: deed,
                      label: deed,
                    })),
                    { value: '__custom__', label: 'OTHER / CUSTOM DEED TYPE...' },
                  ]}
                />
                {showCustomInput && (
                  <TextField
                    label="Custom Deed Description"
                    value={data.descriptionOfDocument}
                    onChange={handleCustomDescriptionChange}
                    placeholder="ENTER CUSTOM DOCUMENT DESCRIPTION"
                    uppercase
                  />
                )}
              </>
            );
          })()}
        </div>

        <TextField
          label="Document No."
          value={data.documentNo || ''}
          onChange={handleDocumentNoChange}
          placeholder="e.g. 3789/2012"
        />

        <SelectField
          label="Book No."
          value={normalizedDocBook}
          onChange={(val) => {
            if (val) {
              onChange({ ...data, documentBookNo: val, bookNo: val });
            } else {
              update('documentBookNo', '');
            }
          }}
          options={[
            { value: '', label: '-- SELECT --' },
            ...Array.from(
              new Set([
                ...bookValues,
                ...(normalizedDocBook ? [normalizedDocBook] : []),
              ])
            ).map((b) => ({ value: b, label: `BOOK ${b.toUpperCase()}` })),
          ]}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <TextField
          label="2. Name and Address of Executant"
          value={data.executantNameAddress}
          onChange={(val) => update('executantNameAddress', val)}
          placeholder="e.g. MUNCIPAL COUNCIL,SIRCILLA"
          uppercase
        />

        <TextField
          label="3. Name and Address of Claimant"
          value={data.claimantNameAddress}
          onChange={(val) => update('claimantNameAddress', val)}
          placeholder="e.g. JILLA NARENDAR"
          uppercase
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <TextField
          label="4. Village & Street"
          value={data.villageAndStreet}
          onChange={(val) => update('villageAndStreet', val)}
          placeholder="e.g. SIRCILLA"
          uppercase
        />
        <TextField
          label="5. Survey No. / Door No."
          value={data.surveyAndDoorNo}
          onChange={(val) => update('surveyAndDoorNo', val)}
          placeholder="e.g. 17"
        />
        <TextField
          label="6. Year of Search"
          value={data.searchYear}
          onChange={(val) => update('searchYear', val)}
          placeholder="e.g. 2012"
        />
      </div>

      <FormSection
        title="Declaration"
        subtitle="Book, Vol, Page, to, Doct. No., and Year"
      />

      <div className="grid grid-cols-3 sm:grid-cols-[0.95fr_0.75fr_0.75fr_1.3fr_1.15fr_1fr] gap-2">
        <SelectField
          label="Book No."
          value={currentBook || '1'}
          onChange={(val) => update('bookNo', val)}
          options={bookValues.map((b) => ({ value: b, label: b }))}
          compact
        />
        <TextField
          label="Vol"
          value={data.volNo}
          onChange={(val) => update('volNo', val)}
          placeholder="-"
          compact
        />
        <TextField
          label="Page"
          value={data.pageFrom}
          onChange={(val) => update('pageFrom', val)}
          placeholder="-"
          compact
        />
        <TextField
          label="to"
          value={data.pageTo}
          onChange={(val) => update('pageTo', val)}
          placeholder="15 to 18"
          compact
        />
        <TextField
          label="Doct. No."
          value={data.doctNo}
          onChange={(val) => update('doctNo', val)}
          placeholder="1559"
          compact
        />
        <TextField
          label="Year"
          value={data.year}
          onChange={(val) => update('year', val)}
          placeholder="2012"
          compact
        />
      </div>

    </div>
  );
};
