import React from 'react';
import { getHouseRowStructures, MvHouseFormData } from '../../types/forms';

interface MvHouseSheetProps {
  data: MvHouseFormData;
}

export const MvHouseSheet: React.FC<MvHouseSheetProps> = ({ data }) => {
  return (
    <div className="a4-paper doc-serif text-[13pt] leading-[1.28]">
      {/* Main bordered document */}
      <div className="border border-black flex-1 flex flex-col">
        {/* Header bar */}
        <div className="px-2.5 pt-1.5 pb-3 border-b border-black flex items-center">
          <div className="w-[44%]">
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
          const filledRows = data.rows.filter((r) => {
            const hasStructs = getHouseRowStructures(r).some(
              (s) =>
                s.natureOfRoof.trim() ||
                s.measurement.trim() ||
                s.floorNo.trim()
            );
            return (
              r.syNo.trim() ||
              r.plotNo.trim() ||
              r.extentSqY.trim() ||
              r.bearingHNo.trim() ||
              r.total.trim() ||
              hasStructs
            );
          });

          const hasSyNo = filledRows.some((r) => r.syNo.trim());
          const hasPlotNo = filledRows.some((r) => r.plotNo.trim());
          const showSyPlot = hasSyNo || hasPlotNo;
          const showExtent = filledRows.some((r) => r.extentSqY.trim());
          const showBearing = filledRows.some((r) => r.bearingHNo.trim());
          const showPlinth = filledRows.some((r) =>
            getHouseRowStructures(r).some(
              (s) =>
                s.natureOfRoof.trim() ||
                s.measurement.trim() ||
                s.floorNo.trim()
            )
          );
          const showTotal = filledRows.some((r) => r.total.trim());

          const cols = [
            showSyPlot ? 'syPlot' : null,
            showExtent ? 'extent' : null,
            showBearing ? 'bearing' : null,
            showPlinth ? 'plinth' : null,
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
                        if (col === 'bearing') {
                          return (
                            <th
                              key={col}
                              className={`w-[22%] px-1 py-1.5 font-normal ${borderClass}`}
                            >
                              <div>Bearing H.No.</div>
                            </th>
                          );
                        }
                        if (col === 'plinth') {
                          return (
                            <th
                              key={col}
                              colSpan={2}
                              className={`w-[33%] px-1 py-1.5 font-normal ${borderClass}`}
                            >
                              <div>Nature of House &amp;</div>
                              <div>Plinth Area</div>
                            </th>
                          );
                        }
                        return (
                          <th
                            key={col}
                            className={`w-[14%] px-1 py-1.5 font-normal ${borderClass}`}
                          >
                            Total
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filledRows.map((row) => {
                      const structs = getHouseRowStructures(row).filter(
                        (s) =>
                          s.natureOfRoof.trim() ||
                          s.measurement.trim() ||
                          s.floorNo.trim()
                      );

                      return (
                        <tr key={row.id} className="align-top">
                          {cols.map((col, idx) => {
                            const borderClass =
                              idx < cols.length - 1
                                ? 'border-r border-black'
                                : '';
                            if (col === 'syPlot') {
                              return (
                                <td
                                  key={col}
                                  className={`px-2 py-2 pb-3 ${borderClass}`}
                                >
                                  {row.syNo.trim() && (
                                    <div>Sy.No/s.{row.syNo}</div>
                                  )}
                                  {row.plotNo.trim() && (
                                    <div>Plot.No/s.{row.plotNo}</div>
                                  )}
                                </td>
                              );
                            }
                            if (col === 'extent') {
                              return (
                                <td
                                  key={col}
                                  className={`px-2 py-2 pb-3 whitespace-nowrap ${borderClass}`}
                                >
                                  {row.extentSqY.trim()
                                    ? `${row.extentSqY} Sq.y`
                                    : ''}
                                </td>
                              );
                            }
                            if (col === 'bearing') {
                              return (
                                <td
                                  key={col}
                                  className={`px-2 py-2 pb-3 text-center ${borderClass}`}
                                >
                                  {row.bearingHNo.trim() && (
                                    <>
                                      <div>Bearing H.No:</div>
                                      <div>{row.bearingHNo}</div>
                                    </>
                                  )}
                                </td>
                              );
                            }
                            if (col === 'plinth') {
                              return (
                                <React.Fragment key={col}>
                                  <td className="w-[16%] px-2 py-2 pb-3 border-r border-black">
                                    {structs.map((s) => {
                                      const meta = [
                                        s.floorNo
                                          ? s.floorNo
                                              .replace(' FLOOR', '')
                                              .trim()
                                          : '',
                                        s.buildingAge
                                          ? `${s.buildingAge}Y`
                                          : '',
                                      ]
                                        .filter(Boolean)
                                        .join(', ');
                                      return (
                                        <div
                                          key={s.id}
                                          className="mb-1 last:mb-0"
                                        >
                                          {s.natureOfRoof.trim() && (
                                            <div>{s.natureOfRoof}</div>
                                          )}
                                          {meta && (
                                            <div className="text-[9.5pt] leading-tight">
                                              ({meta}
                                              {s.stage ? ` - ${s.stage}` : ''})
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </td>
                                  <td
                                    className={`w-[17%] px-2 py-2 pb-3 whitespace-nowrap ${borderClass}`}
                                  >
                                    {structs.map((s) => (
                                      <div
                                        key={s.id}
                                        className="mb-1 last:mb-0"
                                      >
                                        <div>
                                          {s.measurement.trim()
                                            ? `:${s.measurement} Sq.fts`
                                            : ''}
                                        </div>
                                        {(s.floorNo ||
                                          s.buildingAge ||
                                          s.rate) && (
                                          <div className="text-[9.5pt] leading-tight">
                                            {s.rate
                                              ? `@ ${s.rate}/Sq.ft`
                                              : '\u00A0'}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </td>
                                </React.Fragment>
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
                      );
                    })}
                    <tr className="h-full" aria-hidden="true">
                      {cols.map((col, idx) => {
                        const borderClass =
                          idx < cols.length - 1 ? 'border-r border-black' : '';
                        if (col === 'plinth') {
                          return (
                            <React.Fragment key={col}>
                              <td className="w-[16%] border-r border-black" />
                              <td className={`w-[17%] ${borderClass}`} />
                            </React.Fragment>
                          );
                        }
                        return <td key={col} className={borderClass} />;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}

        {/* Situated at line */}
        {data.situatedText.trim() && (
          <div className="px-2.5 py-0.5 border-b border-black">
            Situated at {data.situatedText}
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
