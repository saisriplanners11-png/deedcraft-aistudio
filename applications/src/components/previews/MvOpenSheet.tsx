import React from 'react';
import { MvOpenFormData } from '../../types/forms';

interface MvOpenSheetProps {
  data: MvOpenFormData;
}

export const MvOpenSheet: React.FC<MvOpenSheetProps> = ({ data }) => {
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

  return (
    <div className="a4-paper doc-serif text-[13pt] leading-[1.28]">
      {/* Main bordered document */}
      <div className="border border-black flex-1 flex flex-col">
        {/* Header bar */}
        <div className="px-2.5 pt-1.5 pb-2 border-b border-black">
          <div className="text-center font-bold underline text-[14pt] tracking-wide uppercase">
            APPLICATION FOR MARKET VALUE
          </div>
          <div className="mt-1 flex items-baseline justify-between text-[12pt]">
            <span>Mobile No:{data.mobileNo}</span>
            <span className="underline text-[11.5pt] tracking-wide">ANNEXURE-I</span>
          </div>
        </div>

        {/* Subtitle */}
        <div className="px-2.5 py-1.5 border-b border-black">
          Form of application for issue of market value certificate of immovable property involved in a suit.
        </div>

        {/* Section 1: Village / Mandal / Dist */}
        <div className="h-[14px] border-b border-black" />
        <table className="w-full border-collapse border-b border-black">
          <tbody>
            <tr className="border-b border-black">
              <td className="w-[46%] px-2.5 py-0.5 border-r border-black">
                <div className="flex justify-between">
                  <span>1.</span>
                  <span>Name of the village:</span>
                </div>
              </td>
              <td className="w-[54%] px-2.5 py-0.5">{data.village}</td>
            </tr>
            <tr className="border-b border-black">
              <td className="w-[46%] px-2.5 py-0.5 border-r border-black text-right">
                Mandal:
              </td>
              <td className="w-[54%] px-2.5 py-0.5">{data.mandal}</td>
            </tr>
            <tr>
              <td className="w-[46%] px-2.5 py-0.5 border-r border-black text-right">
                Dist:
              </td>
              <td className="w-[54%] px-2.5 py-0.5">{data.district}</td>
            </tr>
          </tbody>
        </table>

        {/* Section 2: Court Name */}
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

        {/* Section 3: Description of property */}
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

        <div className="py-0.5 text-center border-b border-black">HOUSE SITES</div>
        <div className="h-[14px] border-b border-black" />

        <div className="flex-1 flex flex-col border-b border-black">
          <table className="w-full flex-1 h-full border-collapse">
            <thead>
              <tr className="border-b border-black text-center align-top text-[12pt]">
                <th className="w-[17%] px-1 py-1.5 font-normal border-r border-black">
                  <div>Sy.No/s.</div>
                  <div>Plot.No/s.</div>
                </th>
                <th className="w-[14%] px-1 py-1.5 font-normal border-r border-black">
                  <div>Extent</div>
                  <div>in Sq.y.</div>
                </th>
                <th className="w-[23%] px-1 py-1.5 font-normal border-r border-black">
                  <div>H.No.</div>
                </th>
                <th className="w-[16%] px-1 py-1.5 font-normal border-r border-black">
                  <div>Commercial</div>
                  <div>Residential</div>
                  <div>Zone</div>
                </th>
                <th className="w-[18%] px-1 py-1.5 font-normal border-r border-black">
                  <div>Applicant&apos;s</div>
                  <div>Value per Sq.y</div>
                </th>
                <th className="w-[12%] px-1 py-1.5 font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {filledRows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-2 py-2 pb-3 border-r border-black">
                    {row.syNo.trim() && <div>Sy.No/s. {row.syNo}</div>}
                    {row.plotNo.trim() && <div>Plot.No/s. {row.plotNo}</div>}
                  </td>
                  <td className="px-2 py-2 pb-3 text-right whitespace-nowrap border-r border-black">
                    {row.extentSqY.trim() ? `${row.extentSqY} Sq.y` : ''}
                  </td>
                  <td className="px-2 py-2 pb-3 border-r border-black">
                    {row.nearHNo.trim() && (
                      <div>
                        {row.nearHNoLabel || 'Near H.No.'} {row.nearHNo}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 pb-3 text-center border-r border-black">
                    {row.zone}
                  </td>
                  <td className="px-2 py-2 pb-3 text-right border-r border-black">
                    {row.valuePerSqY}
                  </td>
                  <td className="px-2 py-2 pb-3 text-right">{row.total}</td>
                </tr>
              ))}
              <tr className="h-full" aria-hidden="true">
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td className="border-r border-black" />
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Situated at line */}
        <div className="px-2.5 py-0.5 border-b border-black flex justify-between">
          <span>
            Situated at
            {data.situatedLocality.trim() ? ` ${data.situatedLocality.trim()}` : ''}
          </span>
          <span>
            {[
              data.situatedMandal.trim(),
              data.situatedDistrict.trim() ? `Dist.${data.situatedDistrict.trim()}` : '',
            ]
              .filter(Boolean)
              .join(', ')}
          </span>
        </div>

        {/* Sections 4 & 5 */}
        <table className="w-full border-collapse border-b border-black">
          <tbody>
            <tr className="border-b border-black">
              <td className="w-[54%] border-r border-black p-0 align-top">
                <div className="px-2.5 py-0.5 border-b border-black">
                  4. Name and full address of the
                </div>
                <div className="px-2.5 py-0.5 pl-7">Plaintiff to the suit:</div>
              </td>
              <td className="w-[46%] px-2.5 py-1 align-top whitespace-pre-wrap uppercase">
                {[
                  data.plaintiffNameAddress?.trim(),
                  data.plaintiffRelationLine?.trim()
                    ? /^(S\/O|W\/O|D\/O|S\/W\/D\/O)\b/i.test(
                        data.plaintiffRelationLine.trim()
                      )
                      ? data.plaintiffRelationLine.trim()
                      : `${data.plaintiffRelationType || 'S/O'} ${data.plaintiffRelationLine.trim()}`
                    : '',
                  data.plaintiffResidenceAddress?.trim()
                    ? /^(R\/O|RESIDENT\s+OF)\b/i.test(
                        data.plaintiffResidenceAddress.trim()
                      )
                      ? data.plaintiffResidenceAddress.trim()
                      : `R/O ${data.plaintiffResidenceAddress.trim()}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              </td>
            </tr>
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
          </tbody>
        </table>

        {/* Footer */}
        <div className="px-2.5 pt-3 pb-3 space-y-4">
          <div>Place: {data.place}</div>
          <div>Date:{data.date}</div>
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
