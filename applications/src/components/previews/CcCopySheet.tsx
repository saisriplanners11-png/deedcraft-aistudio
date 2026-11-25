import React from 'react';
import { CcCopyFormData } from '../../types/forms';

interface CcCopySheetProps {
  data: CcCopyFormData;
}

export const CcCopySheet: React.FC<CcCopySheetProps> = ({ data }) => {
  const desc = data.descriptionOfDocument.trim();
  const docNum = (data.documentNo || '').trim();
  const docBook = (data.documentBookNo || '').trim();

  const showDocNum =
    Boolean(docNum) &&
    (!desc || !desc.toLowerCase().includes(docNum.toLowerCase()));
  const formattedNum = docNum.toLowerCase().startsWith('no')
    ? docNum
    : `No.${docNum}`;

  const showBook =
    Boolean(docBook) && !/book\s*no/i.test(`${desc} ${docNum}`);
  const bookLabel = `BOOK NO.${docBook.toUpperCase()}`;

  return (
    <div className="a4-paper doc-serif text-[13pt] leading-[1.3]">
      <div className="border border-black flex-1 flex flex-col">
        {/* Header */}
        <div className="px-3 pt-1.5 pb-2 text-center border-b border-black">
          <div className="text-[18pt] tracking-wide font-normal">CARD</div>
          {data.showCardSubtitle && (
            <div className="text-[10.5pt] leading-tight mt-0.5">
              <div>(Computer Aided Administration of Registration Department)</div>
              <div>Visit us at: http://registration.telangana.gov.in</div>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="w-[155px]" aria-hidden="true" />
            <div className="font-bold text-[13pt] tracking-wide uppercase text-center">
              {data.applicationType} APPLICATION
            </div>
            <div className="w-[170px] text-right text-[11.5pt] whitespace-nowrap">
              Mobile No:{data.mobileNo}
            </div>
          </div>
        </div>

        {/* From / To */}
        <div className="px-2.5 py-2 border-b border-black flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div>From:</div>
            <div>Name and address (In block letters):</div>
            <div className="mt-2 min-h-[20px] uppercase whitespace-pre-wrap">
              {data.fromNameAddress}
            </div>
            {data.relationLine.trim() && (
              <div className="mt-0.5 uppercase">
                {/^(S\/O|W\/O|D\/O|S\/W\/D\/O)\b/i.test(data.relationLine.trim())
                  ? data.relationLine
                  : `${data.relationType || 'S/O'}: ${data.relationLine}`}
              </div>
            )}
            {(data.residenceAddress || '').trim() && (
              <div className="mt-0.5 uppercase whitespace-pre-wrap">
                {/^(R\/O|RESIDENT\s+OF)\b/i.test(
                  (data.residenceAddress || '').trim()
                )
                  ? (data.residenceAddress || '').trim()
                  : `R/O ${(data.residenceAddress || '').trim()}`}
              </div>
            )}
          </div>

          <div className="w-auto max-w-[48%] shrink-0 pt-3 pr-2 text-left">
            <div>To</div>
            <div>The Sub-Registrar,</div>
            <div className="uppercase">
              {data.toOffice.replace(/\.$/, '').trim()}
            </div>
            <div>Sir,</div>
          </div>
        </div>

        {/* Request sentence */}
        <div className="px-2.5 py-1.5 border-b border-black">
          {data.requestText ||
            'Please search books of your office and grant me copies of the under mentioned document.'}
        </div>

        {/* 6 Particulars */}
        <div className="px-2.5 py-2 border-b border-black space-y-1.5">
          <div>
            1. Description of document:
            {desc ? data.descriptionOfDocument : null}
            {showDocNum && (
              <>
                {desc ? ' ' : ''}
                <strong className="font-bold">{formattedNum}</strong>
              </>
            )}
            {showBook && (
              <>
                {desc || showDocNum ? ', ' : ''}
                <strong className="font-bold">{bookLabel}</strong>
              </>
            )}
          </div>
          <div>2. Name and address of executant:{data.executantNameAddress}</div>
          <div>3. Name and address of claimant:{data.claimantNameAddress}</div>
          <div>
            4. Village and Street in which the property is Situated:{data.villageAndStreet}
          </div>
          <div>5. Survey No. And Door No. Of property:{data.surveyAndDoorNo}</div>
          <div>6. The year which search is to be made:{data.searchYear}</div>
        </div>

        {/* Applicant Signature */}
        <div className="px-2.5 pt-4 pb-1.5 border-b border-black text-right flex-1 flex items-end justify-end">
          Signature of the Applicant.
        </div>

        {/* S.No. / C.No. */}
        <div className="px-2.5 py-1 border-b border-black flex items-center">
          <div className="w-[38%]">S.No.{data.sNo ? ` ${data.sNo}` : ''}</div>
          <div>C.No.{data.cNo ? ` ${data.cNo}` : ''}</div>
        </div>

        {/* Date & Fees */}
        <div className="px-2.5 pt-1 pb-4 border-b border-black space-y-0.5">
          <div>Date:{data.date ? ` ${data.date}` : ''}</div>
          <div className="flex">
            <div className="w-[33%]">Application fee</div>
            <div>Rs.{data.applicationFee ? ` ${data.applicationFee}` : ''}</div>
          </div>
          <div className="flex">
            <div className="w-[33%]">User Charge fee</div>
            <div>Rs.{data.userChargeFee ? ` ${data.userChargeFee}` : ''}</div>
          </div>
        </div>

        {/* Total */}
        <div className="px-2.5 py-1 border-b border-black flex">
          <div className="w-[24%]" />
          <div className="w-[9%]">Total</div>
          <div>Rs.{data.totalFee ? ` ${data.totalFee}` : ''}</div>
        </div>

        {/* Declaration Header */}
        <div className="px-2.5 py-0.5 border-b border-black text-center tracking-wide">
          DECLARATION
        </div>

        {/* Book / Vol / Page / Doct.No / Year */}
        <div className="px-2.5 py-0.5 border-b border-black flex flex-wrap gap-x-5">
          <span>
            Book: <strong className="font-bold">{data.bookNo}</strong>
          </span>
          <span>
            Vol:{' '}
            <strong className="font-bold inline-block min-w-[24px]">
              {data.volNo}
            </strong>
          </span>
          <span>
            Page:{' '}
            <strong className="font-bold inline-block min-w-[28px]">
              {data.pageFrom}
            </strong>
          </span>
          <span>
            to <strong className="font-bold">{data.pageTo}</strong>
          </span>
          <span>
            Doct.No.<strong className="font-bold">{data.doctNo}</strong>
          </span>
          <span>
            Year <strong className="font-bold">{data.year}</strong>
          </span>
        </div>

        {/* Stamp / No.of words */}
        <div className="px-2.5 py-0.5 border-b border-black flex">
          <div className="w-[24%]">Stamp{data.stamp ? `: ${data.stamp}` : ''}</div>
          <div>No.of words{data.noOfWords ? `: ${data.noOfWords}` : ''}</div>
        </div>

        {/* Official signatures */}
        <div className="px-2.5 py-1.5 space-y-1">
          <div>Search made by{data.searchMadeBy ? `: ${data.searchMadeBy}` : ''}</div>
          <div>Search verified by{data.searchVerifiedBy ? `: ${data.searchVerifiedBy}` : ''}</div>
          <div>Copy prepared by{data.copyPreparedBy ? `: ${data.copyPreparedBy}` : ''}</div>
          <div className="flex items-center justify-between pt-0.5 pr-8">
            <div className="w-[40%]">
              Copy compared by:{data.copyComparedBy ? ` ${data.copyComparedBy}` : ''}
            </div>
            <div className="w-[30%]">Reader{data.reader ? `: ${data.reader}` : ''}</div>
            <div className="w-[22%] text-right">
              Examiner{data.examiner ? `: ${data.examiner}` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
