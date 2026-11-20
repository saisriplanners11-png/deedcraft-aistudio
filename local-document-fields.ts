import { isoDate } from './deed-format';
import { ALL_FIELDS, PERSON_FIELDS } from './fields';
import { identityMobile, isWrittenMobile, mobileLabel, writtenMobileLabel } from './identity-contact';
import type { Candidate, Role, SourceResult } from './source-draft';

export type LocalPage = { number: number; region: string; text: string; separateContactNote?: boolean };
type Line = { text: string; page: LocalPage };
type Rule = [field: string, label: string, normalize?: (value: string) => string];
const numberLabel = '(?:\\s*(?:No\\.?|Number))?';
const identifier = (value: string) => {
  const compact = value.replace(/\s*([/&-])\s*/g, '$1');
  return /^[\p{L}\p{N}][\p{L}\p{N}./&()-]{0,64}$/u.test(compact) && /\d/.test(compact) ? value : '';
};
const date = (value: string) => {
  const local = value.match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})$/);
  return local ? isoDate(local[1].padStart(2, '0') + '-' + local[3].padStart(2, '0') + '-' + local[4]) : isoDate(value);
};
const paymentDate = (value: string) => date(value.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s+[AP]M)?$/i, ''));
const decimal = '(?:\\d+|\\d{1,3}(?:,\\d{3})+|\\d{1,3}(?:,\\d{2})+,\\d{3})(?:\\.\\d+)?';
const amount = (value: string) => {
  const match = value.match(new RegExp('^(?:₹\\s*|Rs\\.?\\s*)?(' + decimal + ')(?:\\s*/-)?$', 'i'));
  return match?.[1].replace(/,/g, '') || '';
};
const area = (units: string) => (value: string) => {
  const match = value.match(new RegExp('^(' + decimal + ')\\s*(?:' + units + ')?$', 'i'));
  return match?.[1].replace(/,/g, '') || '';
};
const yards = 'sq\\.?\\s*(?:yds?\\.?|yards?)|square yards?';
const feet = 'sq\\.?\\s*(?:ft\\.?|feet)|square feet';
const pin = (value: string) => /^[1-9]\d{5}$/.test(value) ? value : '';
const name = (value: string) => /^[\p{L}\p{M}][\p{L}\p{M} .'’()-]{0,99}$/u.test(value) ? value : '';
const code = (value: string) => /^\d{4}$/.test(value) ? value : '';
const text = (value: string) => value;
const rule = ([field, label, normalize = text]: Rule) => ({
  field, normalize, label: new RegExp('^(?:' + label + ')\\s*[:：=]?$', 'iu'),
  match: new RegExp('^(?:' + label + ')(?:[ \\t]*[:：=][ \\t]*|[ ]*\\t+[ ]*|[ \\t]+[-–][ \\t]*|[ \\t]*(?=\\d))(.+)$', 'iu'),
});

const jurisdiction: Rule[] = [
  ['propState', '(?:Property )?State|రాష్ట్రం', name], ['district', '(?:Property )?District|జిల్లా', name],
  ['mandal', '(?:Property )?Mandal|మండలం', name], ['village', '(?:Property )?Village|గ్రామం', name],
  ['locality', '(?:Property )?Locality|Colony', name], ['pinCode', 'PIN(?:\\s*Code)?', pin],
  ['sro', 'Registration Sub[ -]District|Jurisdiction S\\.?R\\.?O\\.?', name],
  ['districtRegistrar', 'Registration District|District Registrar', name],
];
const directions = ['North', 'South', 'East', 'West'];
const teluguDirections = ['ఉత్తరం', 'దక్షిణం', 'తూర్పు', 'పడమర'];
const schedule: Rule[] = [
  ['plotNo', 'Plot' + numberLabel + '|ప్లాట్\\s*(?:నం\\.?|నంబరు|నంబర్)', identifier],
  ['surveyNo', '(?:Survey|Sy\\.?)' + numberLabel + '|సర్వే\\s*(?:నం\\.?|నంబరు|నంబర్)', identifier],
  ['bearingHNo', '(?:Bearing\\s+)?H\\.?\\s*No\\.?|House (?:No\\.?|Number)|Door (?:No\\.?|Number)', identifier],
  ['extentSqYards', 'Extent\\s*\\(\\s*(?:' + yards + ')\\s*\\)|Extent in (?:' + yards + ')', area(yards)],
  ['extentSqYards', 'Extent', value => new RegExp('(?:' + yards + ')$', 'i').test(value) ? area(yards)(value) : ''],
  ['flatNo', 'Flat' + numberLabel, identifier], ['flatFloorNo', 'Floor (?:No\\.?|Number)'],
  ['apartmentName', 'Apartment (?:Complex )?Name'], ['udsSqYards', 'Undivided (?:Land )?Share|U\\.?D\\.?S\\.?', value => new RegExp('(?:' + yards + ')$', 'i').test(value) ? area(yards)(value) : ''],
  ['superBuiltUpAreaSqFt', '(?:Super )?Built[ -]up Area(?: including common area)?', value => new RegExp('(?:' + feet + ')$', 'i').test(value) ? area(feet)(value) : ''],
  ['roofMaterial', '(?:Nature of Roof|Roof Material)'], ['constructionDescription', 'Type of (?:Structure|Construction)'],
  ...directions.map((side, index): Rule => ['boundary' + side, side + '(?: Boundary(?: of Apartment)?)?|' + teluguDirections[index]]),
  ...directions.map((side): Rule => ['flatBoundary' + side, side + ' Boundary of Flat|Flat Boundary ' + side]),
  ...directions.map((side): Rule => ['dimension' + side, side + ' (?:Dimension|Measurement)']),
];
const valuation: Rule[] = [
  ['govtRate', '(?:Basic|Market) (?:Rate|Value) per (?:' + yards + ')(?:\\s*\\(₹\\))?', amount],
  ['structValue', 'Structure Valuation|Value of (?:the )?Structure', amount],
];
const registration: Rule[] = [
  ['linkDocNo', '(?:Registered |Registration )?(?:Document|Doc\\.?|Doct\\.?)\\s*(?:No\\.?|Number)', value => /^\d{1,10}\s*\/\s*\d{4}$/.test(value) ? value.replace(/\s/g, '') : ''],
  ['linkDocDate', '(?:Deed )?Execution Date|Date of Execution|Executed on|Deed Date', date],
  ['linkSro', 'Registering (?:Office|S\\.?R\\.?O\\.?)|Registered at|Sub[ -]Registrar(?: Office)?|S\\.?R\\.?O\\.?', name],
  ['linkSroCode', 'S\\.?R\\.?O\\.? Code|Office Code', code],
  ['municipalLinkAuthority', 'Issuing Authority', value => /^(?:Sub[ -]Registrar|Tahsildar\s*&\s*Jt\.?\s*Sub[ -]Registrar)$/i.test(value)
    ? (/^Tahsildar/i.test(value) ? 'Tahsildar & Jt. Sub-Registrar' : 'Sub-Registrar') : ''],
  ['mortgageAmount', 'Mortgage Loan Amount|Sanctioned Loan Amount', amount],
  ['mortgageInterestAmount', 'Mortgage Interest Amount', amount],
];
const flatAgreements: Rule[] = [
  ['developmentDocNo', 'Development Agreement(?:[ -]cum[ -]GPA)? (?:Doc(?:ument)?\\.? )?(?:No\\.?|Number)', identifier],
  ['developmentDocDate', 'Development Agreement(?:[ -]cum[ -]GPA)? (?:Document )?Date', date],
  ['developmentSro', 'Development Agreement(?:[ -]cum[ -]GPA)? SRO', name],
  ['developmentSroCode', 'Development Agreement(?:[ -]cum[ -]GPA)? SRO Code', code],
  ['supplementalDocNo', 'Supplemental Agreement (?:Doc(?:ument)?\\.? )?(?:No\\.?|Number)', identifier],
  ['supplementalSro', 'Supplemental Agreement SRO', name],
  ['supplementalSroCode', 'Supplemental Agreement SRO Code', code],
  ['stiltFloors', '(?:Number of )?Stilt Floors', area('')], ['upperFloors', '(?:Number of )?Upper Floors', area('')],
];
const tax: Rule[] = [
  ['houseTaxReceiptNo', 'Book (?:No\\.?|Number)\\s*/\\s*Receipt (?:No\\.?|Number)|(?:House Tax )?Receipt (?:No\\.?|Number)', identifier],
  ['taxPaidDate', 'Tax Paid Date|Date of Payment|Payment Date|Dt\\.? of Collection|Date of Collection|Transaction Date', paymentDate],
  ['localBodyName', 'Local Body(?: Name)?|ULB(?: Name)?|(?:Name of )?(?:Gram )?Panchayat', name],
];
const paymentRef: Record<string, Rule> = {
  cheque: ['refNo', 'Cheque\\s*(?:No\\.?|Number)', value => /^\d{6,10}$/.test(value) ? value : ''],
  dd: ['refNo', '(?:Demand Draft|D\\.?D\\.?)\\s*(?:No\\.?|Number)', value => /^\d{6,12}$/.test(value) ? value : ''],
  upi: ['refNo', 'UPI (?:Transaction ID|(?:Transaction )?Reference(?: (?:No\\.?|Number))?)|RRN', value => /^\d{12}$/.test(value) ? value : ''],
  rtgs: ['refNo', '(?:RTGS |NEFT )?UTR(?:\\s*(?:No\\.?|Number))?|Unique Transaction Reference', value => /^[A-Z0-9]{12,24}$/i.test(value) && /\d/.test(value) ? value : ''],
};
const paymentFields: Rule[] = [
  ['amount', '(?:Payment|Transaction|Cheque|Demand Draft) Amount|Amount (?:Paid|Debited|Transferred)|Amount(?:\\s*\\((?:INR|₹)\\))?', amount],
  ['date', '(?:Payment|Transaction|Cheque|Demand Draft|Transfer) Date|Date of (?:Payment|Transfer)', paymentDate],
  ['bank', '(?:Issuing |Remitting |Payer )?Bank(?: Name)?', name],
  ['branch', '(?:Issuing |Remitting )?Branch(?: Name)?', name],
  ['payer', 'Payer(?: Name)?|Sender(?: Name)?|Remitter(?: Name)?', name],
  ['payee', 'Payee(?: Name)?|Receiver(?: Name)?|Beneficiary(?: Name)?', name],
];
const land: Rule[] = [
  ['vltNo', '(?:Vacant Land Tax(?: Assessment)?|V\\.?L\\.?T\\.?)' + numberLabel, identifier],
  ['layoutFileNo', '(?:Approved )?Layout File' + numberLabel, identifier],
  ['lrsApplicationNo', 'L\\.?R\\.?S\\.?(?:[ -]2020)? Application' + numberLabel, identifier],
  ['lrsApplicationDate', 'L\\.?R\\.?S\\.?(?:[ -]2020)? Application Date', date],
  ['lrsProceedingNo', 'L\\.?R\\.?S\\.? Proceeding' + numberLabel, identifier],
  ['lrsProceedingDate', 'L\\.?R\\.?S\\.? Proceeding Date', date],
];
const enclosure: Record<string, Rule[]> = {
  titleDeed: [['titleDeedNo', '(?:Pattadar Pass ?Book|Title Deed)' + numberLabel, identifier], ['khataNo', 'Khata' + numberLabel, identifier]],
  nala: [['nalaOrderNo', 'NALA Order' + numberLabel, identifier], ['nalaProceedingDate', 'NALA (?:Order|Proceeding) Date|Proceeding Date', date], ['nalaExtent', 'Extent \\(Acre[ -]Guntas\\)', value => /^\d+[-.]\d{1,2}$/.test(value) ? value : '']],
  permissions: [['permBuildingPermitNo', '(?:Building Permit|House Permission|Permission)' + numberLabel, identifier], ['permissionDate', '(?:Building Permit|House Permission|Permission) Date', date], ['permissionAuthorityName', 'Issuing (?:Local )?Authority', name]],
  landLayoutLrs: land, layoutLrs: land, vacantTax: land.slice(0, 1), approvedLayout: land.slice(1, 2),
  lrsApplication: land.slice(2, 4), lrsProceeding: land.slice(4), houseTax: tax, assessment: [],
};
const houseLabel = '(?:Bearing\\s+)?H\\.?\\s*No\\.?|(?:House|Door) (?:No\\.?|Number)';
const ptinLabel = '(?:P\\.?T\\.?I\\.?N\\.?(?:\\s*\\(Property Tax Identification Number\\))?|P\\.?T\\.?I\\.?\\s+No\\.?|Property Tax Identification(?: Number| No\\.?)?|Property Tax ID)' + numberLabel;
const assessmentLabel = 'Assessment (?:No\\.?|Number)';
const pairedLabels: Rule[] = [['houseNo', houseLabel, identifier], ['ptin', ptinLabel, identifier], ['assessment', assessmentLabel, identifier]];
const assessmentHeading = /^House Tax Assessment Details\s*:?$/i;
const endAssessment = /^(?:Current Demand|Arrear|Collection) Details\s*:?$/i;
const expandedPtin = /^PTIN\s*\(Property\s+Tax\s+Identification\s+Number\)\s*[:=]?\s*\d+[ \t]*$/gim;
const headings = /^(?:registered\s+)?(?:sale deed(?: through (?:gpa|agpa))?|deed of sale|gift (?:settlement )?deed|gift settlement|mortgage deed|deed of mortgage|rectification deed|supplemental deed|release deed|reconveyance deed|deed of reconveyance|general power of attorney|agreement of sale cum gpa)\s*$/i;
const scheduleHeading = /^(?:property schedule|schedule(?:\s+of\s+(?:the\s+)?property)?)(?:\s*[-:–]?\s*\(?[A-Z0-9]+\)?)?\s*[:.]?$/i;
const boundariesHeading = /^(?:boundaries of (?:the )?(?:flat|apartment)|(?:property |apartment |flat )?boundaries)\s*:?$/i;
const finishSchedule = /^(?:witness(?:es)?\b|signature(?:s)?\b|form\s+(?:32\s*a|60|61)\b|in witness whereof\b)/i;
const aadhaarNumber = (value: string) => /^[2-9]\d{3}(?:[ -]?\d{4}){2}$/.test(value) ? value.replace(/[ -]/g, '') : '';
const maskedAadhaarSuffix = (value: string) => value.match(/^(?:[xX*•]{4}[ -]?){2}(\d{4})$/u)?.[1] || '';
const gender = (value: string) => ['Male', 'Female', 'Other'].find(option => option.toLowerCase() === value.toLowerCase()) || '';
const birthDate = (value: string) => {
  const parsed = date(value);
  return parsed && Number(parsed.slice(0, 4)) >= 1900 && new Date(parsed).getTime() <= Date.now() ? parsed : '';
};
const occupation = (value: string) =>
  !/^(?:male|female|other|transgender|vendor|vendee|seller|buyer|executant|claimant)$/i.test(value) ? name(value) : '';
const occupiedAs: Rule = ['Occupation', 'Occupation|Profession|OCC\\.?', occupation];
const contactLabels = [['Mobile', writtenMobileLabel, identityMobile], ['Mobile', mobileLabel, identityMobile], occupiedAs] satisfies Rule[];
const contactRules = contactLabels.map(rule);
const writtenMobileRule = rule(contactLabels[0]);
const bareMarginOccupation = /^(?:agriculture|agriculturist|farmer|business|businessperson|self[ -]employed|private employee|government employee|retired|homemaker|student)$/i;
const identity: Rule[] = [
  ['Name', '(?:Full |Applicant |Cardholder(?:’s|\'s)? )?Name|Name of (?:the )?(?:Applicant|Holder|Cardholder)', name],
  ['Dob', 'Date of Birth|Birth Date|D\\.?O\\.?B\\.?', birthDate],
  ['RelativeName', '(?:Father|Mother|Parent|Relative)(?:’s|\'s)? Name', name],
  ['Gender', 'Gender|Sex', gender],
  ['PinCode', 'PIN(?:\\s*Code)?', pin],
  ['Aadhaar', 'Aadhaar(?:' + numberLabel + ')|UID' + numberLabel, aadhaarNumber],
  ['Pan', 'PAN' + numberLabel + '|Permanent Account Number(?: Card)?', value => /^[A-Z]{5}\d{4}[A-Z]$/.test(value.toUpperCase()) ? value.toUpperCase() : ''],
  ...contactLabels,
];

const aadhaarCaption = /\bYour\s+Aadhaa?r\s+(?:No\.?|Number)\s*:?\s*(.*)$/i;
const uidai = /\bUnique\s+[|Il]?dentification\s+Authority\s+\S{2}\s+India\b/i;
const govtIndia = /\bGovernment\s+of\s+India\b/i;

// Keep the left column of the letter separate from stamps, notes and codes.
const printedLine = (line: Line) => line.text.replace(/^[|)]+\s*/, '').split(/\t+| {3,}/, 1)[0].trim();
const trimPunctuation = (value: string) => value.replace(/[,;:\s]+$/, '').trim();
const latinName = (value: string) => /^[A-Za-z][A-Za-z .'’()-]{2,99}$/.test(value) &&
  !/\b(?:india|government|enrolment|signature|district|mandal|aadhaar|mobile|female|male|authority|address)\b/i.test(value) ? value : '';
const dobLine = /(?:^|[/\s])(?:D\.?[O0]\.?B\.?|Date of Birth|పుట్టిన తేద[ీి]|జన్మ తేద[ీి])\s*:?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\s*$/iu;
const yearOfBirthLine = /(?:^|[/\s])(?:Year of Birth|Y\.?O\.?B\.?)\s*:?\s*(\d{4})\s*$/i;
const cardGender = /^(?:[\u0c00-\u0c7f\s\u200c\u200d]*\/\s*)?(male|female|other|పురుషుడు|స్త్రీ)$/iu;
const postalFields: Rule[] = [
  ['HNo', houseLabel, identifier], ['Locality', 'Locality|Colony', name], ['Village', 'VTC|Village|Town|City', name],
  ['Mandal', 'Mandal', name], ['District', 'District', name], ['State', 'State', name], ['PinCode', 'PIN(?:\\s*Code)?', pin],
  ['Mobile', mobileLabel, identityMobile],
];
const labelledIdentityFields = [...identity.filter(([field]) => !contactLabels.some(([contact]) => field === contact)),
  ...postalFields.filter(([field]) => field !== 'Mobile' && field !== 'PinCode')];
const aadhaarRelations: Record<string, string> = {
  'c/o': 'C/O', 'care of': 'C/O', 's/o': 'S/O', 'son of': 'S/O',
  'w/o': 'W/O', 'wife of': 'W/O', 'd/o': 'D/O', 'daughter of': 'D/O',
};

type IdentityReading = { line: Line; field: string; value: string; writtenContact?: true };

function readContactLine(line: Line, writtenContact = false): IdentityReading[] {
  const source = { ...line, text: trimPunctuation(line.text) };
  return [...matchFields(source, contactRules)].map(([field, value]) => ({
    line, field, value, writtenContact: field === 'Mobile' && (writtenContact || writtenMobileRule.match.test(source.text)) ? true : undefined,
  }));
}

/** An Aadhaar letter has a UIDAI heading, a recipient address and a printed Aadhaar caption.
 * A cut-out card can also have its own unlabelled name above the labelled DOB. */
function readAadhaarPage(lines: Line[]): IdentityReading[] {
  const pageText = lines.map(({ text }) => text).join('\n');
  const caption = lines.findIndex(line => aadhaarCaption.test(printedLine(line)));
  const isLetter = caption >= 0 && (uidai.test(pageText) || govtIndia.test(pageText));
  const isCard = !isLetter && govtIndia.test(pageText) && lines.some(line => dobLine.test(printedLine(line)) || yearOfBirthLine.test(printedLine(line)))
    && lines.some(line => aadhaarNumber(printedLine(line)) || maskedAadhaarSuffix(printedLine(line)));
  if (!isLetter && !isCard) return [];

  const readings: IdentityReading[] = [];
  const add = (line: Line, field: string, value: string) => { if (value) readings.push({ line, field, value }); };
  const addNumber = (line: Line, value: string) => {
    add(line, 'Aadhaar', aadhaarNumber(value));
    add(line, 'MaskedAadhaarSuffix', maskedAadhaarSuffix(value));
  };
  const postalLines = new Set<Line>();
  if (isLetter) {
    for (const [index, line] of lines.entries()) {
      const number = printedLine(line).match(aadhaarCaption);
      if (!number) continue;
      const next = lines[index + 1];
      const inline = number[1].trim();
      if (inline) addNumber(line, inline);
      else if (next) addNumber({ ...line, text: line.text + '\n' + next.text }, printedLine(next));
    }
    const toIndex = lines.slice(0, caption).findIndex(line => /^To\s*:?\s*$/i.test(printedLine(line)));
    const enrolment = lines.slice(0, caption).findIndex(line => /\bEnroll?ment\s+No\b/i.test(printedLine(line)));
    const recipient = toIndex >= 0 ? toIndex : enrolment;
    const address = recipient >= 0 ? lines.slice(recipient + 1, caption) : [];
    const postal = postalFields.map(rule);
    // When "To" is unreadable, require a labelled address field inside the recipient block.
    const toPhoneOrPin = address.some(line => {
      const fields = matchFields({ ...line, text: trimPunctuation(printedLine(line)) }, postal);
      return fields.has('PinCode') || fields.has('Mobile');
    });
    if (toIndex >= 0 || toPhoneOrPin) {
      const first = address.slice(0, 4).findIndex(line => latinName(printedLine(line)));
      if (first >= 0) add(address[first], 'Name', latinName(printedLine(address[first])));
      for (const line of address) {
        const value = trimPunctuation(printedLine(line));
        for (const [field, found] of matchFields({ ...line, text: value }, postal)) {
          add(line, field, found);
          if (field === 'Mobile') postalLines.add(line);
        }
        const mandal = value.match(/^(.+?)\s+Mandal$/i);
        if (mandal) add(line, 'Mandal', name(mandal[1]));
        const relative = value.match(/^(C\/O|S\/O|W\/O|D\/O|Care of|Son of|Wife of|Daughter of)(?:\s*:\s*|\s+)(.+)$/i);
        if (relative && latinName(relative[2])) {
          add(line, 'Relation', aadhaarRelations[relative[1].toLowerCase()]);
          add(line, 'RelativeName', relative[2]);
        }
      }
      const numberAndLocality = /^(\d+(?:-\d+){1,5}[A-Za-z]?)(?:,\s*(.*))?$/;
      const house = first < 0 ? undefined : address.slice(first + 1, first + 3)
        .find(line => numberAndLocality.test(trimPunctuation(printedLine(line))));
      if (house) {
        const [, number, locality] = trimPunctuation(printedLine(house)).match(numberAndLocality)!;
        add(house, 'HNo', number);
        add(house, 'Locality', name(locality || ''));
        // Some Aadhaar letters print an unlabelled relative's name between the
        // recipient and the numbered address. The layout does not state the relation.
        const next = address[first + 1];
        if (toIndex >= 0 && toPhoneOrPin && house === address[first + 2]
          && !readings.some(reading => reading.field === 'RelativeName')) {
          const printed = printedLine(next);
          const relative = latinName(trimPunctuation(printed));
          if (printed.endsWith(',') && relative &&
            !/\b(?:colony|nagar|road|street|near|lane|village|ward|layout|block|apartment|building)\b/i.test(relative) &&
            relative.toLowerCase() !== printedLine(address[first]).toLowerCase()) {
            add(next, 'RelativeName', relative);
          }
        }
      }
    }
  }

  const card = isLetter ? lines.slice(caption + 1) : lines;
  for (const [index, line] of card.entries()) {
    const content = printedLine(line);
    const dob = content.match(dobLine);
    const year = content.match(yearOfBirthLine);
    if (!dob && !year) continue;
    add(line, 'Dob', birthDate(dob?.[1] || year?.[1] + '-01-01'));
    const before = card[index - 1];
    if (before) add(before, 'Name', latinName(printedLine(before)));
    const after = card[index + 1];
    const sex = after && printedLine(after).match(cardGender);
    if (sex) add(after, 'Gender', sex[1] === 'పురుషుడు' ? 'Male' : sex[1] === 'స్త్రీ' ? 'Female' : gender(sex[1]));
  }
  if (isCard) for (const line of lines) addNumber(line, printedLine(line));
  for (const [lineIndex, line] of lines.entries()) {
    const columns = splitCells(line.text);
    for (const [index, column] of columns.entries()) {
      if (index === 0 && postalLines.has(line)) continue;
      const note = { ...line, text: column };
      readings.push(...readContactLine(note, index > 0 || !isLetter || lineIndex > caption));
      // Occupation can also be written on its own in a separate notes column.
      if (index > 0 && bareMarginOccupation.test(trimPunctuation(column))) add(note, 'Occupation', trimPunctuation(column));
    }
  }
  return readings;
}

/** A separate card back can supply postal fields when it prints the same full identifier. */
function readAadhaarBack(lines: Line[], expectedNumber: string): IdentityReading[] {
  if (!uidai.test(lines.map(line => line.text).join('\n'))) return [];
  const address = lines.findIndex(line => /^Address\s*:/i.test(line.text));
  const numbers = lines.filter(line => aadhaarNumber(printedLine(line)));
  if (address < 0 || numbers.length !== 1 || aadhaarNumber(printedLine(numbers[0])) !== expectedNumber) return [];
  const end = lines.indexOf(numbers[0]);
  if (end <= address) return [];
  const rules = postalFields.filter(([field]) => field !== 'Mobile').map(rule);
  return readLabelledLines(lines.slice(address + 1, end), rules).map(({ line, field, value }) => ({ line, field, value }));
}

function identityScope(profile: string) {
  if (profile === 'party-person') return { role: 'party-person' as const, prefix: 'person' };
  const [kind, side] = profile.split(':');
  if (!['party', 'guardian'].includes(kind) || (side !== 'executant' && side !== 'claimant')) return null;
  return { role: side, prefix: side + (kind === 'guardian' ? 'Guardian' : '') } as const;
}

export function supportsLocalIdentity(profile: string) {
  return identityScope(profile) !== null;
}

export function supportsLocalRead(profile: string) {
  return supportsLocalIdentity(profile) || profile.startsWith('phase1:')
    || (profile.startsWith('payment:') && !!paymentRef[profile.slice('payment:'.length)])
    || ['jurisdiction', 'flat-agreements', 'property-schedule'].includes(profile);
}

function splitCells(line: string) {
  return line.trim().split(/\t+| *\| *| {3,}/).map(value => value.trim());
}

/** Assign cells only when their headers and the surrounding row line up. */
function alignedRows(lines: Line[], columns: ReturnType<typeof rule>[], repeatable = false) {
  let header: { line: Line; columns: (typeof columns[number] | undefined)[] } | undefined;
  const rows: { line: Line; fields: Map<string, string> }[] = [];
  let group: typeof rows = [];
  const finish = () => {
    if (repeatable || group.length === 1) rows.push(...group);
    group = [];
    header = undefined;
  };
  for (const line of lines) {
    if (line.page !== header?.line.page) finish();
    const cells = splitCells(line.text);
    const possibleHeader = cells.map(cell => columns.find(column => column.label.test(cell)));
    const named = possibleHeader.flatMap(column => column ? [column.field] : []);
    if (named.length >= 2 && new Set(named).size === named.length) {
      finish();
      header = { line, columns: possibleHeader };
      continue;
    }
    if (!header || cells.length !== header.columns.length) { finish(); continue; }
    const fields = new Map<string, string>();
    for (const [index, column] of header.columns.entries()) {
      const value = column?.normalize(cells[index]);
      if (column && value) fields.set(column.field, value);
    }
    const anyInvalid = header.columns.some((column, index) => column && cells[index] && !fields.has(column.field));
    if (!fields.size || anyInvalid || (!repeatable && fields.size < 2)) { finish(); continue; }
    group.push({ line: { page: line.page, text: header.line.text + '\n' + line.text }, fields });
  }
  finish();
  return rows;
}

function matchFields(line: Line, rules: ReturnType<typeof rule>[]): Map<string, string> {
  const fields = new Map<string, string>();
  for (const candidate of rules) {
    const match = line.text.match(candidate.match);
    const value = match && candidate.normalize(match[1].trim());
    if (value && !fields.has(candidate.field)) fields.set(candidate.field, value);
  }
  return fields;
}

/** The Panchayat Raj assessment printout wraps the PTIN label and lists the door on its own line in one property summary. */
function readAssessmentSummary(lines: Line[]) {
  const heading = lines.findIndex(line => assessmentHeading.test(line.text));
  if (heading < 0) return;
  const end = lines.findIndex((line, index) => index > heading && endAssessment.test(line.text));
  if (end < 0) return;
  const section = lines.slice(heading + 1, end);
  const text = section.map(line => line.text).join('\n');
  if (section.some(line => assessmentHeading.test(line.text))) return;
  const wrapped = [...text.matchAll(expandedPtin)];
  if (wrapped.length !== 1 || !wrapped[0][0].includes('\n')) return;
  const quote = wrapped[0][0];
  const line = { page: lines[heading].page, text: quote };
  const rules = pairedLabels.map(rule);
  const fields = matchFields({ ...line, text: quote.replace(/\s+/g, ' ') }, rules);
  if (!fields.has('ptin')) return;

  const labelled = section.flatMap(source => splitCells(source.text).flatMap(cell => {
    const values = matchFields({ ...source, text: cell }, rules);
    return [...values].map(([field, value]) => ({ source, field, value }));
  }));
  const houses = labelled.filter(item => item.field === 'houseNo');
  const assessments = labelled.filter(item => item.field === 'assessment');
  const hasDifferentPtin = labelled.some(item => item.field === 'ptin' && item.value !== fields.get('ptin'));
  if (houses.length !== 1 || assessments.length > 1 || hasDifferentPtin) return { line, fields, pairedHouseLine: undefined };

  const house = houses[0];
  fields.set('houseNo', house.value);
  return { line: { ...line, text: quote + '\n' + house.source.text }, fields, pairedHouseLine: house.source };
}

/** Labelled rows from text PDFs, DOCX tables and OCR can put the value on the next line. */
function readLabelledLines(lines: Line[], rules: ReturnType<typeof rule>[]) {
  const rows = alignedRows(lines, rules).flatMap(({ line, fields }) =>
    [...fields].map(([field, value]) => ({ line, field, value })));
  for (const [index, line] of lines.entries()) {
    const cells = splitCells(line.text);
    if (cells.length > 1) {
      const readings = cells.map(cell => [...matchFields({ ...line, text: cell }, rules)]);
      if (readings.every(values => values.length)) {
        for (const [field, value] of readings.flat()) rows.push({ line, field, value });
        continue;
      }
      if (cells.length === 2 && !rules.some(rule => rule.label.test(cells[1]) || rule.match.test(cells[1]))) {
        const column = rules.find(rule => rule.label.test(cells[0]));
        const value = column?.normalize(cells[1]);
        if (column && value) { rows.push({ line, field: column.field, value }); continue; }
      }
    }
    const exact = matchFields(line, rules);
    if (exact.size) {
      for (const [field, value] of exact) rows.push({ line, field, value });
      continue;
    }
    const matches = rules.filter(rule => rule.label.test(line.text));
    if (!matches.length) continue;
    const adjacent = lines[index + 1];
    if (!adjacent || adjacent.page !== line.page || rules.some(rule => rule.label.test(adjacent.text) || rule.match.test(adjacent.text))) continue;
    const values = new Map<string, string>();
    for (const rule of matches) {
      const value = rule.normalize(adjacent.text);
      if (value) values.set(rule.field, value);
    }
    for (const [field, value] of values) rows.push({ line: { ...line, text: line.text + '\n' + adjacent.text }, field, value });
  }
  return rows;
}

export function readLocalDocumentFields(pages: LocalPage[], profile: string, reconveyance = false): SourceResult {
  const candidates: Candidate[] = [];
  const notes: string[] = [];
  const lines = pages.flatMap(page => page.text.split(/\r?\n/).map(text => ({ page, text: text.trim() })).filter(line => line.text));
  const option = profile.replace(/^phase1:/, '');
  const link = option === 'linkDoc' || option === 'rectificationDeed' || option === 'supplementalDeed';
  const taxUpload = option === 'houseTax' || option === 'assessment';
  const payment = profile.startsWith('payment:') ? paymentRef[profile.slice('payment:'.length)] : undefined;
  const identityTarget = identityScope(profile);
  const scopeRules = (profile.startsWith('phase1:') && enclosure[option]) || [];
  const add = (line: Line, role: Role, field: string, value: string, record = 'primary', writtenContact?: true) => {
    candidates.push({
      id: (role === 'executant' || role === 'claimant' ? 'link-party:' : 'local:') + candidates.length,
      role, record, field, value, quote: line.text, page: line.page.number, region: line.page.region,
      status: 'accepted', handwritten: false, historical: false,
      ...(writtenContact ? { writtenContact } : {}),
    });
  };
  const read = (subset: Line[], specs: Rule[], role: Role) => {
    for (const { line, field, value } of readLabelledLines(subset, specs.map(rule))) add(line, role, field, value);
  };
  const houseRows = (subset: Line[], table = false) => {
    const rules = pairedLabels.map(rule);
    const summaries = table ? pages.flatMap(page => {
      const summary = readAssessmentSummary(subset.filter(line => line.page === page));
      return summary ? [summary] : [];
    }) : [];
    const pairedHouseLines = new Set(summaries.map(summary => summary.pairedHouseLine));
    const labelled = subset.flatMap(line => {
      const direct = matchFields(line, rules);
      if (direct.size) return [{ line, fields: direct }];
      const readings = splitCells(line.text).flatMap(cell => [...matchFields({ ...line, text: cell }, rules)]);
      const fields = new Map(readings);
      return fields.size === readings.length ? [{ line, fields }] : readings.map(reading => ({ line, fields: new Map([reading]) }));
    });
    const rows = table ? [
      ...labelled.filter(row => !(pairedHouseLines.has(row.line) && row.fields.size === 1 && row.fields.has('houseNo'))),
      ...alignedRows(subset, [...pairedLabels, ...tax].map(rule), true),
      ...summaries,
    ] : labelled;
    const printedPtin = rows.some(row => row.fields.has('ptin'));
    for (const { line, fields } of rows) {
      const houseNo = fields.get('houseNo') || '';
      const ptin = fields.get('ptin') || (houseNo || !printedPtin ? fields.get('assessment') || '' : '');
      if (houseNo || ptin) add(line, 'property', 'housePtinPairs', JSON.stringify([{ houseNo, ptin }]));
      if (table) for (const field of ['houseTaxReceiptNo', 'taxPaidDate', 'localBodyName']) {
        const value = fields.get(field);
        if (value) add(line, 'link', field, value);
      }
    }
  };

  if (link) {
    const titles = lines.filter(({ text }) => headings.test(text));
    const titleIndex = titles[0] ? lines.indexOf(titles[0]) : -1;
    const schedules = lines.filter(({ text }) => scheduleHeading.test(text));
    const expectedTitle = option === 'linkDoc' || (option === 'rectificationDeed' ? /rectification/i : /supplemental/i).test(titles[0]?.text || '');
    const registrationField = (field: string) => option === 'linkDoc' ? field : field.replace(/^linkDoc|^link/, option);
    if (titles.length === 1 && expectedTitle && titleIndex < 14) {
      const title = lines[titleIndex];
      add(title, 'link', registrationField('linkDocType'), title.text);
      const beforeSchedule = lines.slice(titleIndex + 1, schedules[0] ? lines.indexOf(schedules[0]) : undefined);
      const endOfOpening = beforeSchedule.findIndex(({ text }) => /^(?:whereas|now this deed|witnesseth)\b/i.test(text));
      const opening = beforeSchedule.slice(0, endOfOpening < 0 ? 16 : Math.min(16, endOfOpening));
      read(opening, registration
        .filter(([field]) => !field.startsWith('mortgage') || (reconveyance && /mortgage/i.test(title.text)))
        .filter(([field]) => option === 'linkDoc' || field.startsWith('link'))
        .map(([field, label, normalize]): Rule => [registrationField(field), label, normalize]), 'link');
      const partyRules = [
        { role: 'executant' as const, label: 'Vendor|Seller|Donor|Executant|Mortgagor|Releasor' },
        { role: 'claimant' as const, label: 'Vendee|Purchaser|Buyer|Donee|Claimant|Mortgagee|Releasee' },
      ];
      for (const { role, label } of partyRules) {
        if (option !== 'linkDoc' || (role === 'executant' && !reconveyance)) continue;
        const partyName = rule([role + 'Name', '(?:' + label + ')(?:\\s+\\d+)? Name', name]);
        for (const [index, line] of opening.entries()) for (const [field, value] of matchFields(line, [partyName])) {
          add(line, role, field, value, 'labelled-party-' + index);
        }
      }
    }
    if (option === 'linkDoc' && schedules.length === 1 && titles.length <= 1) {
      const start = lines.indexOf(schedules[0]) + 1;
      const end = lines.findIndex(({ text }, index) => index >= start && finishSchedule.test(text));
      const property = lines.slice(start, end < 0 ? undefined : end);
      read(property, [...jurisdiction, ...valuation, ...flatAgreements], 'property');
      readSchedule(property);
      houseRows(property);
      const annexure = lines.findIndex(({ text }, index) => index >= start && /^annexure\s*(?:i|1)\s*[-–]?\s*a\s*:?$/i.test(text));
      if (annexure >= 0 && end >= 0 && annexure > end) {
        const stop = lines.findIndex(({ text }, index) => index > annexure && finishSchedule.test(text));
        read(lines.slice(annexure + 1, stop < 0 ? undefined : stop), valuation, 'property');
      }
    } else if (schedules.length > 1 || titles.length > 1) notes.push('Several deed or schedule headings were found. Upload the pages for just this record or enter the details from the original.');
  } else if (taxUpload) {
    read(lines, scopeRules, 'link');
    houseRows(lines, true);
    for (const line of lines) {
      const heading = line.text.match(/^(?:GHMC(?:\s+Property Tax(?: Receipt)?)?|Greater Hyderabad Municipal Corporation|CURE Property Tax Receipt Details|Panchayat Raj(?: Department)?|(?:Local Body Type|ULB Type)\s*:\s*(GHMC|Gram Panchayat|Municipality|Municipal Council|Municipal Corporation))$/i);
      if (heading) {
        const authority = heading[1] || (/panchayat/i.test(line.text) ? 'Gram Panchayat' : 'GHMC');
        add(line, 'property', 'localAuthorityType', /^Municipality$/i.test(authority) ? 'Municipal Council' : authority);
      }
    }
  } else if (payment) {
    const statusRule = rule(['status', '(?:Payment |Transaction )?Status', name]);
    const failed = lines.some(line => /\b(?:failed|unsuccessful|declined|pending|processing|reversed|cancelled|not (?:successful|completed))\b/i.test(matchFields(line, [statusRule]).get('status') || ''));
    const refs = readLabelledLines(lines, [rule(payment)]);
    const distinct = new Set(refs.map(reading => reading.value.toUpperCase()));
    if (failed) notes.push('The proof shows a payment that has not completed. Check the payment before entering it.');
    else if (distinct.size === 1) {
      for (const { line, value } of refs) add(line, 'payment', 'refNo', value);
      const referencePages = new Set(refs.map(({ line }) => line.page));
      read(lines.filter(line => referencePages.has(line.page)), paymentFields, 'payment');
    } else notes.push('The proof does not identify one readable reference for the selected payment method. Check the attachment and enter the details.');
  } else if (scopeRules.length) read(lines, scopeRules, 'link');
  else if (profile === 'jurisdiction') read(lines, [...jurisdiction, ['sro', 'SRO|Sub[ -]Registrar Office', name]], 'property');
  else if (profile === 'flat-agreements') read(lines, flatAgreements, 'property');
  else if (identityTarget) {
    const { role, prefix } = identityTarget;
    const available = role === 'party-person' ? PERSON_FIELDS : ALL_FIELDS;
    const addIdentity = (line: Line, suffix: string, value: string, writtenContact?: true) => {
      const field = prefix + (role === 'party-person' && suffix === 'RelativeName' ? 'RelationName' : suffix);
      if (available.some(item => item.id === field)) add(line, role, field, value, 'primary', writtenContact);
    };
    const aadhaar = pages.flatMap(page => readAadhaarPage(lines.filter(line => line.page === page)));
    const distinct = (field: string) => new Set(aadhaar.filter(item => item.field === field).map(item => item.value.toLowerCase())).size;
    const identityPages = new Set(aadhaar.map(item => item.line.page));
    const fullNumber = aadhaar.find(item => item.field === 'Aadhaar')?.value;
    const endings = new Set(aadhaar.filter(item => item.field === 'Aadhaar' || item.field === 'MaskedAadhaarSuffix')
      .map(item => item.value.slice(-4)));
    const noteReadings = (page: LocalPage) => {
      const noteLines = lines.filter(line => line.page === page);
      if (!noteLines.every(line => contactRules.some(({ match }) => match.test(line.text)))) return [];
      return noteLines.flatMap(line => readContactLine(line, true));
    };
    if (distinct('Aadhaar') > 1 || endings.size > 1 || (identityPages.size > 1 && distinct('Name') > 1)) {
      notes.push('The Aadhaar readings show conflicting identities. Upload one clear Aadhaar document for this party.');
    } else if (aadhaar.length) {
      // A contact-only text attachment belongs to the one ID in this upload.
      const contactPages = distinct('Name') === 1 && distinct('Aadhaar') === 1
        ? pages.filter(page => page.separateContactNote) : [];
      const addressReadings = fullNumber && distinct('Name') === 1 ? pages.filter(page => !identityPages.has(page))
        .flatMap(page => readAadhaarBack(lines.filter(line => line.page === page), fullNumber)) : [];
      for (const { line, field, value, writtenContact } of [...aadhaar, ...addressReadings, ...contactPages.flatMap(noteReadings)]) {
        addIdentity(line, field, value, writtenContact);
      }
    } else {
      const identityReadings = readLabelledLines(lines, [...labelledIdentityFields.map(rule), ...contactRules]);
      const names = new Set(identityReadings.filter(candidate => candidate.field === 'Name').map(candidate => candidate.value.toLowerCase()));
      if (names.size === 1) {
        for (const { line, field, value } of identityReadings) {
          addIdentity(line, field, value, field === 'Mobile' && writtenMobileRule.match.test(line.text) ? true : undefined);
        }
      } else if (!names.size && pages.length === 1 && pages[0].separateContactNote) {
        // The user can attach a dedicated contact note directly to this party.
        for (const { line, field, value, writtenContact } of noteReadings(pages[0])) {
          addIdentity(line, field, value, writtenContact);
        }
      }
    }
  } else if (profile === 'property-schedule') {
    if (lines.filter(line => scheduleHeading.test(line.text)).length > 1) notes.push('Several schedule headings were found. Upload the pages for just this property.');
    else { readSchedule(lines); houseRows(lines); }
  }

  function readSchedule(subset: Line[]) {
    let flat = false;
    const rules = schedule.map(rule);
    let section: Line[] = [];
    const addSection = () => {
      for (const { line, field, value } of readLabelledLines(section, rules)) {
        const target = flat && /^boundary[A-Z]/.test(field) ? 'flatB' + field.slice(1) : field;
        add(line, 'property', target, value);
      }
      section = [];
    };
    for (const line of subset) {
      if (boundariesHeading.test(line.text)) {
        addSection();
        flat = /\bflat\b/i.test(line.text);
      } else section.push(line);
    }
    addSection();
  }

  const byField = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const key = JSON.stringify([candidate.role, candidate.record, candidate.field]);
    const group = byField.get(key) || [];
    const match = group.findIndex(other => other.value.toLowerCase() === candidate.value.toLowerCase());
    if (match < 0) group.push(candidate);
    else if (!isWrittenMobile(group[match]) && isWrittenMobile(candidate)) group[match] = candidate;
    byField.set(key, group);
  }
  const resolved = [...byField.values()].flatMap(group => {
    const preferred = group.filter(isWrittenMobile);
    const usable = preferred.length ? preferred : group;
    if (usable.length === 1 || group[0].field === 'housePtinPairs') return usable;
    notes.push('Conflicting printed values were found. Check the original and enter the correct value for the affected field.');
    return [];
  });
  if (!resolved.length && !notes.length) notes.push(
    identityTarget
      ? 'No identity details could be read reliably. Try a clear, straight photo of one person’s identification, or enter the details from the original.'
      : 'No supported fields could be read reliably. Open the attachment and enter the details from the original.',
  );
  return { candidates: resolved, plans: [], notes: [...new Set(notes)] };
}
