import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { EcFormData } from '../../types/forms';

interface EcSheetProps {
  data: EcFormData;
}

type FitLevel = 0 | 1 | 2 | 3 | 4;

export const EcSheet: React.FC<EcSheetProps> = ({ data }) => {
  const rawDocs =
    data.linkDocuments && data.linkDocuments.length > 0
      ? data.linkDocuments
      : [{ id: 'legacy-1', doctNo: data.doctNo, doctYear: data.doctYear, description: '' }];

  const filledDocs = rawDocs.filter(
    (d) => d.doctNo.trim() || d.doctYear.trim()
  );
  const primaryDoc = filledDocs[0] || rawDocs[0];
  const extraDocs = filledDocs.slice(1);
  const showAgriculturalLands =
    data.includeAgriculturalLands ??
    Boolean(
      data.agriVillage.trim() ||
        data.agriMandal.trim() ||
        data.agriRows.some((row) => row.syNo.trim() || row.extentAcGs.trim())
    );

  const agriRows = showAgriculturalLands ? data.agriRows : [];
  const agriCount = agriRows.length;

  const getBaseFitLevel = useCallback((): FitLevel => {
    if (agriCount >= 16) return 3;
    if (agriCount >= 10) return 2;
    if (agriCount >= 6) return 1;
    if (extraDocs.length >= 4) return 1;
    return 0;
  }, [agriCount, extraDocs.length]);

  const [fitLevel, setFitLevel] = useState<FitLevel>(getBaseFitLevel);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const lastDataRef = useRef<EcFormData>(data);

  useLayoutEffect(() => {
    const base = getBaseFitLevel();
    if (lastDataRef.current !== data) {
      lastDataRef.current = data;
      if (fitLevel !== base) {
        setFitLevel(base);
        return;
      }
    }
    const el = sheetRef.current;
    if (el && el.scrollHeight > el.clientHeight + 2 && fitLevel < 4) {
      setFitLevel((prev) => (prev < 4 ? ((prev + 1) as FitLevel) : prev));
    }
  }, [data, fitLevel, getBaseFitLevel]);

  const isCompactSheet = fitLevel >= 2;
  const isUltraCompact = fitLevel >= 4;
  const useTwoColumnAgri = fitLevel >= 3 && agriRows.length > 1;

  const splitIndex = Math.ceil(agriRows.length / 2);
  const leftAgriRows = useTwoColumnAgri ? agriRows.slice(0, splitIndex) : agriRows;
  const rightAgriRows = useTwoColumnAgri ? agriRows.slice(splitIndex) : [];

  const rootTextClass = isUltraCompact
    ? 'text-[10.5pt] leading-[1.14]'
    : isCompactSheet
    ? 'text-[11.5pt] leading-[1.18]'
    : 'text-[13pt] leading-[1.28]';

  const agriCellClass = isUltraCompact
    ? 'px-1.5 py-[1px] text-[9.5pt] leading-[1.12]'
    : fitLevel >= 2
    ? 'px-2 py-[2px] text-[10.5pt] leading-[1.15]'
    : fitLevel === 1
    ? 'px-2 py-[3px] text-[11.5pt] leading-[1.18]'
    : 'px-2 py-1 pb-2';

  const propCellPy = isCompactSheet ? 'py-[1px]' : 'py-0.5';

  return (
    <div ref={sheetRef} className={`a4-paper doc-serif ${rootTextClass}`}>
      <div className="border border-black flex-1 flex flex-col">
        {/* Header */}
        <div
          className={`px-2.5 ${
            isCompactSheet ? 'pt-0.5 pb-1' : 'pt-1 pb-1.5'
          } border-b border-black text-center`}
        >
          <div
            className={`${
              isCompactSheet ? 'text-[15.5pt]' : 'text-[18pt]'
            } font-bold tracking-wide`}
          >
            CARD
          </div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="w-[155px]" aria-hidden="true" />
            <div
              className={`font-bold ${
                isCompactSheet ? 'text-[12pt]' : 'text-[13.5pt]'
              } tracking-wide`}
            >
              APPLICATION FOR E.C.
            </div>
            <div className="w-[170px] text-right text-[11.5pt] whitespace-nowrap">
              Mobile No:{data.mobileNo}
            </div>
          </div>
        </div>

        {/* Name of Applicant */}
        <div className={`px-2.5 ${isCompactSheet ? 'py-1' : 'py-1.5'} border-b border-black`}>
          Name of the Applicant:{' '}
          <span className="uppercase">
            {[
              data.applicantName?.trim(),
              data.relationLine?.trim()
                ? /^(S\/O|W\/O|D\/O|S\/W\/D\/O)\b/i.test(data.relationLine.trim())
                  ? data.relationLine.trim()
                  : `${data.relationType || 'S/O'} ${data.relationLine.trim()}`
                : '',
              data.residenceAddress?.trim()
                ? /^(R\/O|RESIDENT\s+OF)\b/i.test(data.residenceAddress.trim())
                  ? data.residenceAddress.trim()
                  : `R/O ${data.residenceAddress.trim()}`
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </span>
        </div>

        {/* House / Open Plot Description */}
        <div
          className={`${isCompactSheet ? 'py-0.5 text-[11.5pt]' : 'py-1 text-[13pt]'} text-center border-b border-black`}
        >
          DESCRIPTION OF THE PROPERTY (FOR HOUSE/OPEN PLOT)
        </div>
        <div className={`${isCompactSheet ? 'h-[5px]' : 'h-[10px]'} border-b border-black`} />

        <table className="w-full border-collapse border-b border-black">
          <tbody>
            <tr className="border-b border-black">
              <td className={`w-[30%] px-1.5 ${propCellPy} border-r border-black text-right`}>
                Corporation/Town/Village:
              </td>
              <td className={`w-[20%] px-1.5 ${propCellPy} border-r border-black`}>
                {data.corporationTownVillage}
              </td>
              <td className={`w-[29%] px-1.5 ${propCellPy} border-r border-black`} colSpan={2}>
                <div>Mandal: {data.mandal}</div>
              </td>
              <td className={`w-[21%] px-1.5 ${propCellPy} align-top`} rowSpan={5}>
                <div>District:{data.district}</div>
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className={`px-2 ${propCellPy} border-r border-black text-right`}>Door No:</td>
              <td className={`px-2 ${propCellPy} border-r border-black`}>
                {data.doorNo.trim()
                  ? data.doorNoType &&
                    !new RegExp(
                      `\\(\\s*${data.doorNoType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)`,
                      'i'
                    ).test(data.doorNo)
                    ? `${data.doorNo.trim()} (${data.doorNoType})`
                    : data.doorNo.trim()
                  : ''}
              </td>
              <td className={`px-2 ${propCellPy} border-r border-black`} colSpan={2}>
                <div>Plot No: {data.plotNo}</div>
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className={`px-2 ${propCellPy} border-r border-black text-right`}>Survey No:</td>
              <td className={`px-2 ${propCellPy} border-r border-black`}>{data.surveyNo}</td>
              <td className={`px-2 ${propCellPy} border-r border-black`} colSpan={2}>
                <div>Extent: {data.extentSqY ? `${data.extentSqY} Sq.y` : 'Sq.y'}</div>
              </td>
            </tr>
            <tr className="border-b border-black">
              <td className={`px-2 ${propCellPy} border-r border-black text-right`}>
                Name of the Location:
              </td>
              <td className={`px-2 ${propCellPy} border-r border-black`}>{data.locationName}</td>
              <td className={`px-2 ${propCellPy} border-r border-black`} colSpan={2}>
                <div>Plinth Area in Sq.ft: {data.plinthAreaSqFt}</div>
              </td>
            </tr>
            <tr>
              <td className={`px-2 ${propCellPy} border-r border-black text-right`}>
                Name of the Apartment:
              </td>
              <td className={`px-2 ${propCellPy} border-r border-black`}>{data.apartmentName}</td>
              <td className={`px-2 ${propCellPy} border-r border-black`} colSpan={2}>
                <div>UDS{data.uds ? `: ${data.uds}` : ''}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Agricultural Lands */}
        <div
          className={`${
            isCompactSheet ? 'py-0.5 text-[12px]' : 'py-1 text-[13.5px]'
          } text-center border-b border-black`}
        >
          IN CASE OF AGRICULTURAL LANDS
        </div>

        <div
          className={`px-2 py-0.5 border-b border-black grid grid-cols-[1.05fr_1fr_1fr] gap-2 items-baseline ${
            fitLevel >= 1 ? 'text-[11.5pt]' : ''
          }`}
        >
          <div>Village: {showAgriculturalLands ? data.agriVillage : ''}</div>
          <div>Mandal: {showAgriculturalLands ? data.agriMandal : ''}</div>
          <div>Dist:{showAgriculturalLands ? data.agriDistrict : ''}</div>
        </div>

        <div className="flex-1 flex flex-col border-b border-black">
          {useTwoColumnAgri ? (
            <table className="w-full flex-1 h-full border-collapse">
              <thead>
                <tr
                  className={`border-b border-black ${
                    isUltraCompact ? 'text-[9.5pt]' : 'text-[10.5pt]'
                  }`}
                >
                  <th className="w-[17%] px-1.5 py-0.5 font-normal text-left border-r border-black">
                    Sy.No/s.
                  </th>
                  <th className="w-[17%] px-1.5 py-0.5 font-normal text-left border-r border-black">
                    Extent (Ac-Gs)
                  </th>
                  <th className="w-[16%] px-1.5 py-0.5 font-normal text-left border-r-2 border-black">
                    Classification
                  </th>
                  <th className="w-[17%] px-1.5 py-0.5 font-normal text-left border-r border-black">
                    Sy.No/s.
                  </th>
                  <th className="w-[17%] px-1.5 py-0.5 font-normal text-left border-r border-black">
                    Extent (Ac-Gs)
                  </th>
                  <th className="w-[16%] px-1.5 py-0.5 font-normal text-left">
                    Classification
                  </th>
                </tr>
              </thead>
              <tbody>
                {leftAgriRows.map((leftRow, idx) => {
                  const rightRow = rightAgriRows[idx];
                  return (
                    <tr key={leftRow.id} className="align-top">
                      <td className={`${agriCellClass} border-r border-black text-left`}>
                        {leftRow.syNo}
                      </td>
                      <td className={`${agriCellClass} border-r border-black text-left`}>
                        {leftRow.extentAcGs}
                      </td>
                      <td className={`${agriCellClass} border-r-2 border-black text-left`}>
                        {leftRow.classification}
                      </td>
                      <td className={`${agriCellClass} border-r border-black text-left`}>
                        {rightRow?.syNo || ''}
                      </td>
                      <td className={`${agriCellClass} border-r border-black text-left`}>
                        {rightRow?.extentAcGs || ''}
                      </td>
                      <td className={`${agriCellClass} text-left`}>
                        {rightRow?.classification || ''}
                      </td>
                    </tr>
                  );
                })}
                <tr className="h-full" aria-hidden="true">
                  <td className="w-[17%] border-r border-black" />
                  <td className="w-[17%] border-r border-black" />
                  <td className="w-[16%] border-r-2 border-black" />
                  <td className="w-[17%] border-r border-black" />
                  <td className="w-[17%] border-r border-black" />
                  <td className="w-[16%]" />
                </tr>
              </tbody>
            </table>
          ) : (
            <table className="w-full flex-1 h-full border-collapse">
              <thead>
                <tr
                  className={`border-b border-black ${
                    fitLevel >= 2 ? 'text-[11pt]' : fitLevel === 1 ? 'text-[12pt]' : ''
                  }`}
                >
                  <th className="w-[34%] px-2 py-0.5 font-normal text-left border-r border-black">
                    Sy.No/s.
                  </th>
                  <th className="w-[33%] px-2 py-0.5 font-normal text-left border-r border-black">
                    Extent in Ac-Gs
                  </th>
                  <th className="w-[33%] px-2 py-0.5 font-normal text-left">
                    Classification
                  </th>
                </tr>
              </thead>
              <tbody>
                {agriRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className={`${agriCellClass} border-r border-black text-left`}>
                      {row.syNo}
                    </td>
                    <td className={`${agriCellClass} border-r border-black text-left`}>
                      {row.extentAcGs}
                    </td>
                    <td className={`${agriCellClass} text-left`}>{row.classification}</td>
                  </tr>
                ))}
                <tr className="h-full" aria-hidden="true">
                  <td className="w-[34%] border-r border-black" />
                  <td className="w-[33%] border-r border-black" />
                  <td className="w-[33%]" />
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Boundaries */}
        <div className={`px-2 ${isCompactSheet ? 'py-0.5' : 'py-1'} border-b border-black`}>
          <div className="flex justify-between items-start gap-4">
            <div className={`${isCompactSheet ? 'space-y-0.5' : 'space-y-1'} min-w-0 flex-1`}>
              <div className="underline">Boundaries of the Property:</div>
              <div>
                Property belongs to Smt./Sri: <strong className="font-bold">{data.belongsTo}</strong>
              </div>
              <div>East : {data.east}</div>
              <div>West : {data.west}</div>
              <div>North: {data.north}</div>
              <div>South: {data.south}</div>
            </div>
            <div className="pr-10 shrink-0">
              <div className="flex items-start gap-1.5">
                <span>Doct.No:</span>
                <div className="flex flex-col">
                  <span>
                    {(primaryDoc?.doctNo || data.doctNo).trim()}/
                    {(primaryDoc?.doctYear || data.doctYear).trim()}
                  </span>
                  {extraDocs.map((doc) => (
                    <span key={doc.id}>
                      {doc.doctNo && doc.doctYear
                        ? `${doc.doctNo.trim()}/${doc.doctYear.trim()}`
                        : doc.doctNo.trim() || doc.doctYear.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Period of Search & Office Section */}
        <div
          className={`px-2 ${
            isUltraCompact
              ? 'pt-1 pb-1 space-y-0.5'
              : isCompactSheet
              ? 'pt-1 pb-1 space-y-1'
              : 'pt-1.5 pb-1.5 space-y-1.5'
          }`}
        >
          <div>
            Period of search From:{' '}
            {data.periodFrom.trim() ? (
              <strong className="font-bold inline-block min-w-[95px]">
                {data.periodFrom}
              </strong>
            ) : (
              <span className="inline-block min-w-[95px]">.....................</span>
            )}{' '}
            To <strong className="font-bold ml-3">{data.periodTo}</strong>
          </div>
          <div>
            Date: <strong className="font-bold">{data.date}</strong>
          </div>
          <div className="flex justify-between items-center pt-0.5 pr-1">
            <span className="w-[24%]" />
            <strong className="font-bold">To be filled by Sub-Registrar</strong>
            <span>Signature of the Applicant</span>
          </div>
          <div className="font-bold">General search No.</div>
          <div>E. C. Fees</div>
          <div className="flex justify-between pr-1">
            <span>Receipt No.</span>
            <span>Signature of the Applicant</span>
          </div>
          <div className={`${isCompactSheet ? 'text-[10.5pt]' : 'text-[12pt]'} whitespace-nowrap`}>
            Search made in............... index..................for.......................From.........................To.................
          </div>
          <div>Search made and certificate prepared by:</div>
        </div>
      </div>
    </div>
  );
};
