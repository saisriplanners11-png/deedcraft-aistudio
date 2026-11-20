import React from 'react';
import { IndentFormData } from '../../types/forms';

interface IndentSheetProps {
  data: IndentFormData;
}

export const IndentSheet: React.FC<IndentSheetProps> = ({ data }) => {
  const categoryText = data.category;

  return (
    <div className="a4-paper-compact doc-serif text-[13pt] leading-[1.26]">
      <div className="border border-black flex-1 flex flex-col">
        {/* Header */}
        <div className="px-2.5 pt-1 pb-1 text-center border-b border-black">
          <div className="text-[18pt]">CARD</div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="w-[155px]" aria-hidden="true" />
            <div className="text-[15pt] tracking-wide">INDENT FOR STAMPS</div>
            <div className="w-[170px] text-right text-[11.5pt] whitespace-nowrap">
              {data.mobileNo.trim() ? `Mobile No.${data.mobileNo}` : ''}
            </div>
          </div>
        </div>

        {/* 4 Indent Items */}
        {(() => {
          const valNum = parseFloat(data.valueOfStamps.replace(/,/g, '').trim());
          const qtyNum = parseFloat(data.quantity.replace(/,/g, '').trim());
          const computedTotal =
            !Number.isNaN(valNum) && !Number.isNaN(qtyNum)
              ? String(Math.round(valNum * qtyNum))
              : '';
          const totalText = (data.totalAmount || '').trim() || computedTotal;
          const qtyText = data.quantity.trim();

          const items = [
            categoryText.trim()
              ? {
                  num: '1.',
                  label: 'Category:',
                  value: <span className="font-bold">{categoryText}</span>,
                }
              : null,
            data.valueOfStamps.trim() || totalText
              ? {
                  num: '2.',
                  label: 'Value of Stamps',
                  value: (
                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-0.5 font-bold">
                      {data.valueOfStamps.trim() && (
                        <span>{`Rs.${data.valueOfStamps.trim()}/-`}</span>
                      )}
                      {qtyText && <span>{`No. of Stamps: ${qtyText}`}</span>}
                      {totalText && <span>{`Total: Rs.${totalText}/-`}</span>}
                    </div>
                  ),
                }
              : null,
            data.purchaserDetails.trim()
              ? {
                  num: '3.',
                  label: 'Name of purchaser with Father name and resident.',
                  value: (
                    <span className="uppercase whitespace-pre-wrap">
                      {data.purchaserDetails}
                    </span>
                  ),
                }
              : null,
            data.forWhomDetails.trim()
              ? {
                  num: '4.',
                  label: 'For whom with father Name And resident.',
                  value: (
                    <span className="uppercase whitespace-pre-wrap">
                      {data.forWhomDetails}
                    </span>
                  ),
                }
              : null,
          ].filter(
            (
              x
            ): x is {
              num: string;
              label: string;
              value: React.JSX.Element;
            } => x !== null
          );

          if (items.length === 0) return null;

          return (
            <table className="w-full border-collapse border-b border-black">
              <tbody>
                {items.map((item, idx) => {
                  const isLast = idx === items.length - 1;
                  return (
                    <React.Fragment key={item.num}>
                      <tr className={!isLast ? 'border-b border-black' : ''}>
                        <td className="w-[5%] px-2 py-0.5 border-r border-black align-top">
                          {item.num}
                        </td>
                        <td className="w-[29%] px-2 py-0.5 border-r border-black text-right align-top">
                          {item.label}
                        </td>
                        <td className="w-[66%] px-2 py-0.5 align-top">
                          {item.value}
                        </td>
                      </tr>
                      {!isLast && (
                        <tr className="border-b border-black">
                          <td colSpan={3} className="h-[8px]" />
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          );
        })()}

        {/* Signature of person who tender money */}
        <div className="px-3 pt-2 pb-1 border-b border-black flex-1 flex items-end justify-end">
          Signature of the person who tenor money.
        </div>

        {/* Bottom Office Grid */}
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="w-[26%] border-r border-black p-0 align-top">
                {data.dated.trim() && (
                  <div className="px-2 py-0.5 border-b border-black text-right">
                    Dated:
                  </div>
                )}
                {data.indentNo.trim() && (
                  <div className="px-2 py-0.5 border-b border-black text-right">
                    Indent No:
                  </div>
                )}
                <div className="px-2 py-0.5 border-b border-black text-right whitespace-nowrap">
                  Signature of Sharff.
                </div>
                <div className="h-[12px]" />
              </td>
              <td className="w-[74%] px-2 py-0.5 align-top">
                <div className="flex flex-col justify-between min-h-[76px]">
                  <div>
                    {data.dated.trim() && <div>{data.dated}</div>}
                    {data.indentNo.trim() && (
                      <div className="mt-0.5">{data.indentNo}</div>
                    )}
                  </div>
                  <div className="text-center pl-24 pb-0.5">Signature.</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
