import React from 'react';
import { MvOpenFormData } from '../../types/forms';

interface MvOpenSheetProps {
  data: MvOpenFormData;
}

export const MvOpenSheet: React.FC<MvOpenSheetProps> = ({ data }) => {
  return (
    <div className="a4-paper doc-serif text-[13pt] leading-[1.28]">
      {/* Main bordered document */}
      <div className="border border-black flex-1 flex flex-col">
        {/* Header bar */}
        <div className="px-2.5 pt-1.5 pb-3 border-b border-black flex items-center">
          <div className="w-[42%]">
            {data.mobileNo.trim() ? `Mobile No:${data.mobileNo}` : ''}
          </div>
          <div className="underline text-[13.5pt] tracking-wide">ANNEXURE-I</div>
        </div>

        {/* Subtitle */}
        <div className="px-2.5 py-1.5 border-b border-black">
          Form of application for issue of market value certificate of immovable property involved in a suit.
        </div>

        {/* Section 1: Village / Mandal / Dist */}
        {(() => {
          const sec1Items = [
            data.village.trim()
              ? { label: 'Name of the village:', value: data.village }
              : null,
            data.mandal.trim()
              ? { label: 'Mandal:', value: data.mandal }
              : null,
            data.district.trim()
              ? { label: 'Dist:', value: data.district }
              : null,
          ].filter((x): x is { label: string; value: string } => x !== null);

          if (sec1Items.length === 0) return null;

          return (
            <>
              <div className="h-[14px] border-b border-black" />
              <table className="w-full border-collapse border-b border-black">
                <tbody>
                  {sec1Items.map((item, idx) => (
                    <tr
                      key={item.label}
                      className={
                        idx < sec1Items.length - 1 ? 'border-b border-black' : ''
                      }
                    >
                      <td className="w-[46%] px-2.5 py-0.5 border-r border-black">
                        {idx === 0 ? (
                          <div className="flex justify-between">
                            <span>1.</span>
                            <span>{item.label}</span>
                          </div>
                        ) : (
                          <div className="text-right">{item.label}</div>
                        )}
                      </td>
                      <td className="w-[54%] px-2.5 py-0.5">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          );
        })()}

        {/* Section 2: Court Name */}
        {data.courtName.trim() && (
          <>
            <div className="h-[14px] border-b border-black" />
            <table className="w-full border-collapse border-b border-black">
              <tbody>
                <tr className="border-b border-black">
                  <td className="w-[46%] px-2.5 py-0.5 border-r border-black">
                    <div className="flex justify-between">
                      <span>2.</span>
                      <span>Name of the Court where the suit</span>
                    </div>
                  </td>
                  <td className="w-[54%] px-2.5 py-0.5" />
                </tr>
                <tr>
                  <td className="px-2.5 py-0.5 border-r border-black text-right">
                    Is proposed to be filed:
                  </td>
                  <td className="px-2.5 py-0.5">{data.courtName}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Section 3: Description of property */}
        {(() => {
          const filledRows = data.rows.filter(
            (r) =>
              r.syNo.trim() ||
              r.plotNo.trim() ||
              r.extentSqY.trim() ||
              r.nearHNo.trim() ||
              r.zone.trim() ||
              r.valuePerSqY.trim() ||
              r.total.trim()
          );

          const hasSyNo = filledRows.some((r) => r.syNo.trim());
          const hasPlotNo = filledRows.some((r) => r.plotNo.trim());
          const showSyPlot = hasSyNo || hasPlotNo;
          const showExtent = filledRows.some((r) => r.extentSqY.trim());
          const showHNo = filledRows.some((r) => r.nearHNo.trim());
          const showZone = filledRows.some((r) => r.zone.trim());
          const showValue = filledRows.some((r) => r.valuePerSqY.trim());
          const showTotal = filledRows.some((r) => r.total.trim());

          const cols = [
            showSyPlot ? 'syPlot' : null,
            showExtent ? 'extent' : null,
            showHNo ? 'hno' : null,
            showZone ? 'zone' : null,
            showValue ? 'value' : null,
            showTotal ? 'total' : null,
          ].filter((c): c is string => c !== null);

          if (cols.length === 0) {
            return <div className="flex-1 border-b border-black" />;
          }

          return (
            <>
              <div className="h-[14px] border-b border-black" />
              <table className="w-full border-collapse border-b border-black">
                <tbody>
                  <tr>
                    <td className="w-[46%] px-2.5 py-0.5 border-r border-black">
                      <div className="flex justify-between">
                        <span>3.</span>
                        <span>Description of the property:</span>
                      </div>
                    </td>
                    <td className="w-[54%] px-2.5 py-0.5" />
                  </tr>
                </tbody>
              </table>

              <div className="py-0.5 text-center border-b border-black">
                HOUSE SITES
              </div>
              <div className="h-[14px] border-b border-black" />

              <div className="flex-1 flex flex-col border-b border-black">
                <table className="w-full flex-1 h-full border-collapse">
                  <thead>
                    <tr className="border-b border-black text-center align-top text-[12pt]">
                      {cols.map((col, idx) => {
                        const borderClass =
                          idx < cols.length - 1 ? 'border-r border-black' : '';
                        if (col === 'syPlot') {
                          return (
                            <th
                              key={col}
                              className={`w-[17%] px-1 py-1.5 font-normal ${borderClass}`}
                            >
                              {hasSyNo && <div>Sy.No/s.</div>}
                              {hasPlotNo && <div>Plot.No/s.</div>}
                            </th>
                          );
                        }
                        if (col === 'extent') {
                          return (
                            <th
                              key={col}
                              className={`w-[14%] px-1 py-1.5 font-normal ${borderClass}`}
                            >
                              <div>Extent</div>
                              <div>in Sq.y.</div>
                            </th>
                          );
                        }
                        if (col === 'hno') {
                          return (
                            <th
                              key={col}
                              className={`w-[23%] px-1 py-1.5 font-normal ${borderClass}`}
                            >
                              <div>H.No.</div>
                            </th>
                          );
                        }
                        if (col === 'zone') {
                          return (
                            <th
                              key={col}
                              className={`w-[16%] px-1 py-1.5 font-normal ${borderClass}`}
                            >
                              <div>Commercial</div>
                              <div>Residential</div>
                              <div>Zone</div>
                            </th>
                          );
                        }
                        if (col === 'value') {
                          return (
                            <th
                              key={col}
                              className={`w-[18%] px-1 py-1.5 font-normal ${borderClass}`}
                            >
                              <div>Applicant&apos;s</div>
                              <div>Value per Sq.y</div>
                            </th>
                          );
                        }
                        return (
                          <th
                            key={col}
                            className={`w-[12%] px-1 py-1.5 font-normal ${borderClass}`}
                          >
                            Total
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filledRows.map((row) => (
                      <tr key={row.id} className="align-top">
                        {cols.map((col, idx) => {
                          const borderClass =
                            idx < cols.length - 1 ? 'border-r border-black' : '';
                          if (col === 'syPlot') {
                            return (
                              <td
                                key={col}
                                className={`px-2 py-2 pb-3 ${borderClass}`}
                              >
                                {row.syNo.trim() && (
                                  <div>Sy.No/s. {row.syNo}</div>
                                )}
                                {row.plotNo.trim() && (
                                  <div>Plot.No/s. {row.plotNo}</div>
                                )}
                              </td>
                            );
                          }
                          if (col === 'extent') {
                            return (
                              <td
                                key={col}
                                className={`px-2 py-2 pb-3 text-right whitespace-nowrap ${borderClass}`}
                              >
                                {row.extentSqY.trim()
                                  ? `${row.extentSqY} Sq.y`
                                  : ''}
                              </td>
                            );
                          }
                          if (col === 'hno') {
                            return (
                              <td
                                key={col}
                                className={`px-2 py-2 pb-3 ${borderClass}`}
                              >
                                {row.nearHNo.trim() && (
                                  <div>
                                    {row.nearHNoLabel || 'Near H.No.'}{' '}
                                    {row.nearHNo}
                                  </div>
                                )}
                              </td>
                            );
                          }
                          if (col === 'zone') {
                            return (
                              <td
                                key={col}
                                className={`px-2 py-2 pb-3 text-center ${borderClass}`}
                              >
                                {row.zone}
                              </td>
                            );
                          }
                          if (col === 'value') {
                            return (
                              <td
                                key={col}
                                className={`px-2 py-2 pb-3 text-right ${borderClass}`}
                              >
                                {row.valuePerSqY}
                              </td>
                            );
                          }
                          return (
                            <td
                              key={col}
                              className={`px-2 py-2 pb-3 text-right ${borderClass}`}
                            >
                              {row.total}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="h-full" aria-hidden="true">
                      {cols.map((col, idx) => (
                        <td
                          key={col}
                          className={
                            idx < cols.length - 1 ? 'border-r border-black' : ''
                          }
                        />
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}

        {/* Situated at line */}
        {(data.situatedLocality.trim() ||
          data.situatedMandal.trim() ||
          data.situatedDistrict.trim()) && (
          <div className="px-2.5 py-0.5 border-b border-black flex justify-between">
            <span>
              Situated at
              {data.situatedLocality.trim()
                ? ` ${data.situatedLocality.trim()}`
                : ''}
            </span>
            <span>
              {[
                data.situatedMandal.trim(),
                data.situatedDistrict.trim()
                  ? `Dist.${data.situatedDistrict.trim()}`
                  : '',
              ]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
        )}

        {/* Sections 4 & 5 */}
        {(data.plaintiffNameAddress.trim() ||
          data.applicantNameAddress.trim()) && (
          <table className="w-full border-collapse border-b border-black">
            <tbody>
              {data.plaintiffNameAddress.trim() && (
                <tr
                  className={
                    data.applicantNameAddress.trim()
                      ? 'border-b border-black'
                      : ''
                  }
                >
                  <td className="w-[54%] border-r border-black p-0 align-top">
                    <div className="px-2.5 py-0.5 border-b border-black">
                      4. Name and full address of the
                    </div>
                    <div className="px-2.5 py-0.5 pl-7">
                      Plaintiff to the suit:
                    </div>
                  </td>
                  <td className="w-[46%] px-2.5 py-1 align-top whitespace-pre-wrap">
                    {data.plaintiffNameAddress}
                  </td>
                </tr>
              )}
              {data.applicantNameAddress.trim() && (
                <tr>
                  <td className="w-[54%] border-r border-black p-0 align-top">
                    <div className="px-2.5 py-0.5 border-b border-black">
                      5. Name and full address of the Applicant
                    </div>
                    <div className="px-2.5 py-0.5 pl-8">
                      (if other than the Plaintiff to the suit):
                    </div>
                  </td>
                  <td className="w-[46%] px-2.5 py-1 align-top whitespace-pre-wrap">
                    {data.applicantNameAddress}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Footer */}
        <div className="px-2.5 pt-3 pb-3 space-y-4">
          {data.place.trim() && <div>Place: {data.place}</div>}
          {data.date.trim() && <div>Date:{data.date}</div>}
          <div className="flex justify-between items-center pt-1 pr-2">
            <span>Received annexure-II</span>
            <span>Signature of the Applicant.</span>
          </div>
          <div className="pt-5">Applicant.</div>
        </div>
      </div>
    </div>
  );
};
