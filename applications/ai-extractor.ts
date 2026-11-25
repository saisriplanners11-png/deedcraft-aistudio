import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { FormType } from './src/types/forms';

export interface UploadedDocumentPart {
  mimeType: string;
  base64Data: string;
  name?: string;
}

interface ExtractionOptions {
  apiKey: string;
  model: string;
  signal: AbortSignal;
  files: UploadedDocumentPart[];
}

function getCcCopySchema() {
  return {
    type: Type.OBJECT,
    properties: {
      applicationType: {
        type: Type.STRING,
        description:
          'Either "CERTIFIED COPY" or "PERSONAL SEARCH". Default to "CERTIFIED COPY" unless Personal Search is explicitly requested.',
      },
      mobileNo: {
        type: Type.STRING,
        description: '10-digit mobile number if explicitly present in the document; otherwise "".',
      },
      toOffice: {
        type: Type.STRING,
        description:
          'Sub-Registrar office (SRO) town/name in uppercase without trailing period (e.g. "SIRCILLA", "VEMULAWADA", "KARIMNAGAR"), only if present in the document; otherwise "".',
      },
      fromNameAddress: {
        type: Type.STRING,
        description:
          'ONLY the first/primary Applicant name in uppercase (person name only, without S/O, W/O, D/O, age, or address). If not present, "".',
      },
      relationType: {
        type: Type.STRING,
        description: 'One of "S/O", "W/O", "D/O", or "S/W/D/O" if present; otherwise "".',
      },
      relationLine: {
        type: Type.STRING,
        description:
          'Father or husband name ONLY in uppercase (without S/O, W/O, D/O prefix) if present; otherwise "".',
      },
      residenceAddress: {
        type: Type.STRING,
        description:
          'ONLY the applicant village/town name in uppercase (e.g. "SIRCILLA", "VEMULAWADA"). Do NOT include H.No., house number, street, colony, mandal, district, pincode, or R/O prefix. If not present, "".',
      },
      descriptionOfDocument: {
        type: Type.STRING,
        description:
          'Registered deed type in uppercase (e.g. "SALE DEED", "GIFT DEED", "GIFT SETTLEMENT DEED", "LEASE DEED", "MORTGAGE DEED", "PARTITION DEED", "RELEASE DEED", "RECTIFICATION DEED", "AGREEMENT OF SALE", etc.) if present; otherwise "".',
      },
      documentNo: {
        type: Type.STRING,
        description:
          'Document number with year if present (e.g. "3789/2012"); otherwise "".',
      },
      documentBookNo: {
        type: Type.STRING,
        description:
          'Book number digit only (e.g. "1", "3", "4") if explicitly stated in the document; otherwise "".',
      },
      executantNameAddress: {
        type: Type.STRING,
        description:
          'ONLY the first/primary Executant (vendor/seller/donor/lessor) name in uppercase. Do NOT include S/O, W/O, D/O, age, occupation, Aadhaar, address, or co-executants.',
      },
      claimantNameAddress: {
        type: Type.STRING,
        description:
          'ONLY the first/primary Claimant (vendee/buyer/donee/lessee) name in uppercase. Do NOT include S/O, W/O, D/O, age, occupation, Aadhaar, address, or co-claimants.',
      },
      villageAndStreet: {
        type: Type.STRING,
        description:
          'Village, locality, and street where the property is situated in uppercase, if present; otherwise "".',
      },
      surveyAndDoorNo: {
        type: Type.STRING,
        description:
          'Survey No., Plot No., and/or Door/House No. of the property as shown in the document; otherwise "".',
      },
      searchYear: {
        type: Type.STRING,
        description: '4-digit registration year to search (e.g. "2012") if present; otherwise "".',
      },
      bookNo: {
        type: Type.STRING,
        description: 'Declaration Book number digit only (e.g. "1") if stated; otherwise "".',
      },
      volNo: {
        type: Type.STRING,
        description: 'Volume number if explicitly mentioned in the document; otherwise "".',
      },
      pageFrom: {
        type: Type.STRING,
        description: 'Start page number if explicitly mentioned in the document; otherwise "".',
      },
      pageTo: {
        type: Type.STRING,
        description: 'End page number if explicitly mentioned in the document; otherwise "".',
      },
      doctNo: {
        type: Type.STRING,
        description: 'Document number digits only (e.g. "3789") if present; otherwise "".',
      },
      year: {
        type: Type.STRING,
        description: '4-digit document year (e.g. "2012") if present; otherwise "".',
      },
    },
  };
}

function getMvOpenSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      mobileNo: {
        type: Type.STRING,
        description: 'Applicant mobile number if present in document; otherwise "".',
      },
      village: {
        type: Type.STRING,
        description: 'Name of the village/town where the property is situated; otherwise "".',
      },
      mandal: {
        type: Type.STRING,
        description: 'Name of the mandal if present; otherwise "".',
      },
      district: {
        type: Type.STRING,
        description: 'Name of the district if present; otherwise "".',
      },
      courtName: {
        type: Type.STRING,
        description: 'Court name ONLY if explicitly mentioned in the document; otherwise "".',
      },
      rows: {
        type: Type.ARRAY,
        description: 'List of open plot / house site rows found in the document.',
        items: {
          type: Type.OBJECT,
          properties: {
            syNo: { type: Type.STRING, description: 'Survey number(s), else "".' },
            plotNo: { type: Type.STRING, description: 'Plot number(s), else "".' },
            extentSqY: {
              type: Type.STRING,
              description: 'Extent in square yards (number/digits, e.g. "200"), else "".',
            },
            nearHNoLabel: {
              type: Type.STRING,
              description:
                'One of "Near H.No.", "Adjacent H.No.", "Open Place Bearing H.No.", "Demolished H.No." if a reference H.No. is present; default "Near H.No.".',
            },
            nearHNo: {
              type: Type.STRING,
              description: 'Near/Adjacent/Bearing House Number if present; else "".',
            },
            zone: {
              type: Type.STRING,
              description:
                'One of "Residential", "Commercial", "Semi-Commercial", "Industrial", or "" if not stated.',
            },
            valuePerSqY: {
              type: Type.STRING,
              description: 'Value per Sq.y in Rs. if stated; else "".',
            },
            total: {
              type: Type.STRING,
              description: 'Total market value / consideration if stated; else "".',
            },
          },
        },
      },
      situatedLocality: {
        type: Type.STRING,
        description: 'Colony / locality / ward name where property is situated; else "".',
      },
      situatedMandal: {
        type: Type.STRING,
        description: 'Town / mandal name where property is situated; else "".',
      },
      situatedDistrict: {
        type: Type.STRING,
        description: 'District name where property is situated; else "".',
      },
      plaintiffNameAddress: {
        type: Type.STRING,
        description:
          'ONLY the first/primary Claimant (or Plaintiff / Buyer / Owner) name in uppercase, without S/O, W/O, age, full address, or other co-parties.',
      },
      plaintiffRelationType: {
        type: Type.STRING,
        description: 'One of "S/O", "W/O", "D/O", or "S/W/D/O" for Plaintiff/Claimant if present; otherwise "".',
      },
      plaintiffRelationLine: {
        type: Type.STRING,
        description:
          'Father or husband name ONLY in uppercase (without S/O, W/O, D/O prefix) for Plaintiff/Claimant if present; otherwise "".',
      },
      plaintiffResidenceAddress: {
        type: Type.STRING,
        description:
          'ONLY the Plaintiff/Claimant village/town name in uppercase (e.g. "SIRCILLA", "VEMULAWADA"). Do NOT include H.No., house number, street, colony, mandal, district, pincode, or R/O prefix. If not present, "".',
      },
      applicantNameAddress: {
        type: Type.STRING,
        description:
          'ONLY the first/primary Applicant name in uppercase if explicitly different from Plaintiff/Claimant, without S/O, age, or address; otherwise "".',
      },
      place: {
        type: Type.STRING,
        description: 'Place name if explicitly stated for application; otherwise "".',
      },
      date: {
        type: Type.STRING,
        description:
          'Application date in DD/MM/YYYY ONLY if this is already a filled application form (do NOT use old deed registration dates); otherwise "".',
      },
    },
  };
}

function getMvHouseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      mobileNo: {
        type: Type.STRING,
        description: 'Applicant mobile number if present in document; otherwise "".',
      },
      village: {
        type: Type.STRING,
        description: 'Name of the village/town where the house is situated; otherwise "".',
      },
      mandal: {
        type: Type.STRING,
        description: 'Name of the mandal if present; otherwise "".',
      },
      district: {
        type: Type.STRING,
        description: 'Name of the district if present; otherwise "".',
      },
      courtName: {
        type: Type.STRING,
        description: 'Court name ONLY if explicitly mentioned in the document; otherwise "".',
      },
      rows: {
        type: Type.ARRAY,
        description: 'House/building entries with plinth area.',
        items: {
          type: Type.OBJECT,
          properties: {
            syNo: { type: Type.STRING, description: 'Survey number(s), else "".' },
            plotNo: { type: Type.STRING, description: 'Plot number(s), else "".' },
            extentSqY: { type: Type.STRING, description: 'Site extent in Sq.y, else "".' },
            bearingHNo: {
              type: Type.STRING,
              description: 'Bearing House Number (e.g. "3-7-114"), else "".',
            },
            rccSqFts: {
              type: Type.STRING,
              description: 'R.C.C. plinth area in Sq.fts (digits/number), else "".',
            },
            tinshedSqFts: {
              type: Type.STRING,
              description: 'TINSHED plinth area in Sq.fts, else "".',
            },
            bTilesSqFts: {
              type: Type.STRING,
              description: 'B.TILES plinth area in Sq.fts, else "".',
            },
            customRoofLabel: {
              type: Type.STRING,
              description: 'Any other roof type label if stated, else "".',
            },
            customRoofSqFts: {
              type: Type.STRING,
              description: 'Sq.fts for other roof type if stated, else "".',
            },
            total: {
              type: Type.STRING,
              description: 'Total value / consideration if stated, else "".',
            },
          },
        },
      },
      situatedText: {
        type: Type.STRING,
        description:
          'Locality, town/mandal, and district string (e.g. "Shanthinagar, Sircilla, Dist.Rajanna Sircilla.") if present in document; otherwise "".',
      },
      plaintiffNameAddress: {
        type: Type.STRING,
        description:
          'ONLY the first/primary Claimant (or Plaintiff / Buyer / Owner) name in uppercase, without S/O, W/O, age, full address, or other co-parties.',
      },
      plaintiffRelationType: {
        type: Type.STRING,
        description: 'One of "S/O", "W/O", "D/O", or "S/W/D/O" for Plaintiff/Claimant if present; otherwise "".',
      },
      plaintiffRelationLine: {
        type: Type.STRING,
        description:
          'Father or husband name ONLY in uppercase (without S/O, W/O, D/O prefix) for Plaintiff/Claimant if present; otherwise "".',
      },
      plaintiffResidenceAddress: {
        type: Type.STRING,
        description:
          'ONLY the Plaintiff/Claimant village/town name in uppercase (e.g. "SIRCILLA", "VEMULAWADA"). Do NOT include H.No., house number, street, colony, mandal, district, pincode, or R/O prefix. If not present, "".',
      },
      applicantNameAddress: {
        type: Type.STRING,
        description:
          'ONLY the first/primary Applicant name in uppercase if explicitly different from Plaintiff/Claimant, without S/O, age, or address; otherwise "".',
      },
      place: {
        type: Type.STRING,
        description: 'Place name if explicitly stated for application; otherwise "".',
      },
      date: {
        type: Type.STRING,
        description:
          'Application date in DD/MM/YYYY ONLY if this is already a filled application form (do NOT use old deed registration dates); otherwise "".',
      },
    },
  };
}

function getEcSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      applicantName: {
        type: Type.STRING,
        description:
          'ONLY the first/primary Applicant (or first Claimant) name in uppercase, without S/O, W/O, age, or address.',
      },
      relationType: {
        type: Type.STRING,
        description: 'One of "S/O", "W/O", "D/O", or "S/W/D/O" if present; otherwise "".',
      },
      relationLine: {
        type: Type.STRING,
        description:
          'Father or husband name ONLY in uppercase (without S/O, W/O, D/O prefix) if present; otherwise "".',
      },
      residenceAddress: {
        type: Type.STRING,
        description:
          'ONLY the applicant village/town name in uppercase (e.g. "SIRCILLA", "VEMULAWADA"). Do NOT include H.No., house number, street, colony, mandal, district, pincode, or R/O prefix. If not present, "".',
      },
      mobileNo: {
        type: Type.STRING,
        description: 'Applicant mobile number if present in document; otherwise "".',
      },
      corporationTownVillage: {
        type: Type.STRING,
        description: 'Corporation / Town / Village for house/plot if present; otherwise "".',
      },
      mandal: { type: Type.STRING, description: 'Mandal name if present; otherwise "".' },
      district: { type: Type.STRING, description: 'District name if present; otherwise "".' },
      doorNo: {
        type: Type.STRING,
        description:
          'ONLY the Door / House No. value (e.g. "10-234"), without Near/Adjacent/Bearing H.No. label; otherwise "".',
      },
      doorNoType: {
        type: Type.STRING,
        description:
          'One of "Near H.No.", "Adjacent H.No.", "Bearing H.No." ONLY if explicitly described as near/adjacent/bearing house no.; otherwise "".',
      },
      plotNo: { type: Type.STRING, description: 'Plot No. if present; otherwise "".' },
      surveyNo: { type: Type.STRING, description: 'Survey No. if present; otherwise "".' },
      extentSqY: { type: Type.STRING, description: 'Extent in Sq.y if present; otherwise "".' },
      locationName: {
        type: Type.STRING,
        description: 'Locality / colony name if present; otherwise "".',
      },
      plinthAreaSqFt: {
        type: Type.STRING,
        description: 'Plinth area in Sq.ft if present; otherwise "".',
      },
      apartmentName: {
        type: Type.STRING,
        description: 'Apartment name if flat; otherwise "".',
      },
      uds: { type: Type.STRING, description: 'Undivided share (UDS) if flat; otherwise "".' },
      includeAgriculturalLands: {
        type: Type.BOOLEAN,
        description:
          'True ONLY if agricultural land survey numbers with Ac-Gs extent are present in the document; false otherwise.',
      },
      agriVillage: {
        type: Type.STRING,
        description: 'Agricultural village ONLY if agricultural land is present; otherwise "".',
      },
      agriMandal: {
        type: Type.STRING,
        description: 'Agricultural mandal ONLY if agricultural land is present; otherwise "".',
      },
      agriDistrict: {
        type: Type.STRING,
        description: 'Agricultural district ONLY if agricultural land is present; otherwise "".',
      },
      agriRows: {
        type: Type.ARRAY,
        description: 'Agricultural survey number rows ONLY if agricultural land is present.',
        items: {
          type: Type.OBJECT,
          properties: {
            syNo: { type: Type.STRING, description: 'Survey No.' },
            extentAcGs: { type: Type.STRING, description: 'Extent in Ac-Gs.' },
            classification: {
              type: Type.STRING,
              description: '"Wet", "Dry", "Irrigated Dry", or "".',
            },
          },
        },
      },
      belongsTo: {
        type: Type.STRING,
        description:
          'ONLY the first/primary Claimant (or Property Owner) name in uppercase without S/O, W/O, age, or address, or "SELF" if explicitly stated as SELF; otherwise "".',
      },
      doctNo: {
        type: Type.STRING,
        description: 'Primary document number if present; otherwise "".',
      },
      doctYear: {
        type: Type.STRING,
        description: 'Primary document 4-digit registration year if present; otherwise "".',
      },
      linkDocuments: {
        type: Type.ARRAY,
        description: 'All document and prior link document numbers found in the document.',
        items: {
          type: Type.OBJECT,
          properties: {
            doctNo: { type: Type.STRING, description: 'Document number.' },
            doctYear: { type: Type.STRING, description: '4-digit registration year.' },
          },
        },
      },
      north: { type: Type.STRING, description: 'North boundary if present; otherwise "".' },
      south: { type: Type.STRING, description: 'South boundary if present; otherwise "".' },
      east: { type: Type.STRING, description: 'East boundary if present; otherwise "".' },
      west: { type: Type.STRING, description: 'West boundary if present; otherwise "".' },
      periodFrom: {
        type: Type.STRING,
        description: 'Search period start date in DD/MM/YYYY if stated; otherwise "".',
      },
      periodTo: {
        type: Type.STRING,
        description: 'Search period end date in DD/MM/YYYY if stated; otherwise "".',
      },
      date: {
        type: Type.STRING,
        description:
          'Application date in DD/MM/YYYY ONLY if this is already a filled application form (do NOT use old deed registration dates); otherwise "".',
      },
    },
  };
}

function getIndentSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      mobileNo: { type: Type.STRING, description: 'Purchaser mobile number.' },
      category: {
        type: Type.STRING,
        description:
          'One of: "Spl.Adh", "Non Judicial", "Share Transfer", "Notary Stamps", "Foreign Bill", "Court fee", "Revenue Stamp".',
      },
      valueOfStamps: {
        type: Type.STRING,
        description: 'Numeric stamp value in rupees without Rs. or /- (e.g. "1000").',
      },
      quantity: { type: Type.STRING, description: 'Number of stamps if mentioned.' },
      purchaserDetails: {
        type: Type.STRING,
        description:
          'ONLY the first/primary purchaser name in uppercase (without S/O, W/O, D/O, age, or address).',
      },
      purchaserRelationType: {
        type: Type.STRING,
        description: 'One of "S/O", "W/O", "D/O", or "S/W/D/O" for purchaser if present; otherwise "".',
      },
      purchaserRelationLine: {
        type: Type.STRING,
        description:
          'Purchaser father or husband name ONLY in uppercase (without S/O, W/O, D/O prefix) if present; otherwise "".',
      },
      purchaserResidenceAddress: {
        type: Type.STRING,
        description:
          'ONLY the purchaser village/town name in uppercase (e.g. "SIRCILLA", "VEMULAWADA"). Do NOT include H.No., street, colony, mandal, district, pincode, or R/O prefix. If not present, "".',
      },
      forWhomDetails: {
        type: Type.STRING,
        description: 'For whom with father name and resident, or "SELF".',
      },
      dated: { type: Type.STRING, description: 'Date if stated in DD/MM/YYYY.' },
      indentNo: { type: Type.STRING, description: 'Indent number if stated.' },
    },
  };
}

function getSchemaForForm(formType: FormType) {
  switch (formType) {
    case 'ccCopy':
      return getCcCopySchema();
    case 'mvOpen':
      return getMvOpenSchema();
    case 'mvHouse':
      return getMvHouseSchema();
    case 'ec':
      return getEcSchema();
    case 'indent':
      return getIndentSchema();
  }
}

export function extractFirstPartyName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let text = raw.trim();
  if (!text) return '';
  text = text.split(/\r?\n/)[0].trim();
  text = text.replace(/^\s*(?:\(?1\)?[.)]\s*)/, '');
  text = text.split(/\s+(?:2[.)]|\(2\))\s+/i)[0].trim();
  text = text
    .split(
      /\s*,?\s*\b(?:S\/O|W\/O|D\/O|C\/O|S\/W\/D\/O|AGED?|R\/O|OCC|AADHAAR|UID|RESIDENT\s+OF)\b[:.\s-]*/i
    )[0]
    .trim();
  return text.replace(/[,;:\-]+$/, '').trim().toUpperCase();
}

export function cleanRelationLine(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^(?:S\/O|W\/O|D\/O|C\/O|S\/W\/D\/O)[:.\s-]*/i, '')
    .replace(/[,;:\-]+$/, '')
    .trim()
    .toUpperCase();
}

export function cleanResidenceVillageOnly(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let text = raw.split(/\r?\n/)[0].trim();
  if (!text) return '';
  text = text.replace(/^(?:R\/O|RESIDENT\s+OF|V\/O|VILLAGE|VILL\.?)[:.\s-]*/i, '');
  text = text.replace(/\s*\b(?:PIN\s*(?:CODE)?|PINCODE)?[-:\s]*\d{6}\b.*$/i, '');
  text = text.split(/\s*,?\s*\b(?:MDL|MANDAL|DIST|DISTRICT|TQ|TALUK|STATE|TELANGANA|T\.S\.?)\b[:.\s-]*/i)[0].trim();
  if (text.includes(',')) {
    const parts = text
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !/^(?:H\.?\s*NO|D\.?\s*NO|DOOR\s*NO|FLAT\s*NO|PLOT\s*NO|WARD|ROAD|STREET|COLONY|NAGAR)\b/i.test(p));
    if (parts.length > 0) {
      text = parts[parts.length - 1];
    }
  }
  text = text
    .replace(/\s*\(?\s*(?:V|VILL|VILLAGE)\s*\)?\.?$/i, '')
    .replace(/[,;:\-.]+$/, '')
    .trim();
  return text.toUpperCase();
}

function sanitizeExtractedFields(
  formType: FormType,
  parsed: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...parsed };
  if (formType === 'ccCopy') {
    out.fromNameAddress = extractFirstPartyName(out.fromNameAddress);
    out.relationLine = cleanRelationLine(out.relationLine);
    out.residenceAddress = cleanResidenceVillageOnly(out.residenceAddress);
    out.executantNameAddress = extractFirstPartyName(out.executantNameAddress);
    out.claimantNameAddress = extractFirstPartyName(out.claimantNameAddress);
  } else if (formType === 'mvOpen' || formType === 'mvHouse') {
    out.plaintiffNameAddress = extractFirstPartyName(out.plaintiffNameAddress);
    out.plaintiffRelationLine = cleanRelationLine(out.plaintiffRelationLine);
    out.plaintiffResidenceAddress = cleanResidenceVillageOnly(
      out.plaintiffResidenceAddress
    );
    out.applicantNameAddress = extractFirstPartyName(out.applicantNameAddress);
  } else if (formType === 'ec') {
    out.applicantName = extractFirstPartyName(out.applicantName);
    out.relationLine = cleanRelationLine(out.relationLine);
    out.residenceAddress = cleanResidenceVillageOnly(out.residenceAddress);
    out.belongsTo = extractFirstPartyName(out.belongsTo);
  } else if (formType === 'indent') {
    out.purchaserDetails = extractFirstPartyName(out.purchaserDetails);
    out.purchaserRelationLine = cleanRelationLine(out.purchaserRelationLine);
    out.purchaserResidenceAddress = cleanResidenceVillageOnly(
      out.purchaserResidenceAddress
    );
  }
  return out;
}

async function detectFormType(
  ai: GoogleGenAI,
  { files, model, signal }: ExtractionOptions
): Promise<FormType> {
  const mediaParts = files.map((file) => ({
    inlineData: { mimeType: file.mimeType, data: file.base64Data },
  }));
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        ...mediaParts,
        {
          text: [
            'Classify which Telangana Registration & Stamps (CARD) form best fits the attached document(s) or image(s):',
            '- "ccCopy": Certified Copy / Personal Search application, or a Sale/Lease/Gift/Mortgage deed needing a Certified Copy.',
            '- "mvOpen": Market Value Certificate (Annexure-I) for an open plot / house site without building plinth area.',
            '- "mvHouse": Market Value Certificate (Annexure-I) for a house/building with R.C.C., Tinshed, or B.Tiles plinth area.',
            '- "ec": Encumbrance Certificate (E.C.) application, boundary schedule, or agricultural land extent.',
            '- "indent": Indent for Stamps / Stamp purchase requisition (Spl.Adh, Non Judicial, Court fee, etc.).',
          ].join('\n'),
        },
      ],
    },
    config: {
      abortSignal: signal,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          formType: {
            type: Type.STRING,
            description: 'Must be one of: ccCopy, mvOpen, mvHouse, ec, indent',
          },
        },
      },
    },
  });

  try {
    const parsed = JSON.parse((response.text ?? '{}').trim()) as {
      formType?: string;
    };
    const ft = parsed.formType;
    if (
      ft === 'ccCopy' ||
      ft === 'mvOpen' ||
      ft === 'mvHouse' ||
      ft === 'ec' ||
      ft === 'indent'
    ) {
      return ft;
    }
  } catch {
    // Fall back to ccCopy
  }
  return 'ccCopy';
}

function formatGeminiError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; message?: string; status?: string };
    };
    const innerMsg = parsed?.error?.message;
    const status = parsed?.error?.status;
    const code = parsed?.error?.code;
    if (code === 403 || status === 'PERMISSION_DENIED' || status === 'API_KEY_INVALID') {
      return new Error(
        'Gemini API key is invalid or missing. Please check your API key in Settings > Secrets.'
      );
    }
    if (code === 402 || code === 429 || status === 'RESOURCE_EXHAUSTED') {
      return new Error(
        innerMsg ||
          'Gemini API quota or prepayment credits exhausted. Please check billing/key in Settings > Secrets.'
      );
    }
    if (innerMsg) {
      return new Error(innerMsg);
    }
  } catch {
    // Raw message is already plain text
  }
  return err instanceof Error ? err : new Error(raw);
}

function countFilledKeys(obj: Record<string, unknown>): number {
  return Object.entries(obj).filter(([, val]) => {
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'boolean') return val;
    return typeof val === 'string' && val.trim().length > 0;
  }).length;
}

export async function extractFormFieldsFromDocument(params: ExtractionOptions & { targetForm: FormType | 'auto' }): Promise<{
  mode: 'single';
  formType: FormType;
  fields: Record<string, unknown>;
  extractedSummary: string;
}> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey });

  try {
    const resolvedForm: FormType =
      params.targetForm === 'auto'
        ? await detectFormType(ai, params)
        : params.targetForm;

    const schema = getSchemaForForm(resolvedForm);

    const systemInstruction = [
      'You are a precision data extraction assistant for Indian (Telangana Registration & Stamps / CARD) property application forms.',
      'Read all visible text, tables, handwritten notes, stamps, Telugu-transliterated English names, survey numbers, house numbers, document numbers, boundaries, and mobile numbers across ALL attached PDFs and/or images (which may be multiple pages of the same deed or related documents).',
      'Combine relevant information across all attached pages/images accurately.',
      'Extract ONLY the exact fields defined in the JSON schema for this form and ONLY values clearly present or directly derivable from the uploaded files.',
      'For Certified Copy (ccCopy), Market Value (mvOpen, mvHouse), and EC Application (ec): extract ONLY the first/primary Executant name and first/primary Claimant/Applicant/Plaintiff name (person name only, without S/O, W/O, D/O, age, occupation, Aadhaar, residential address, or additional co-executants/co-claimants). Put S/O / W/O / D/O relation name in relationLine (or plaintiffRelationLine for Market Value), and in residenceAddress / plaintiffResidenceAddress extract ONLY the applicant/plaintiff village/town name (no H.No., street, colony, mandal, district, or R/O prefix).',
      'Leave any field not present in the uploaded documents as empty string "" (or empty array [] / false for booleans).',
      'Never fabricate or guess missing phone numbers, court names, districts, villages, page numbers, or addresses.',
    ].join(' ');

    const prompt = `Read all ${params.files.length} attached document/image file(s) and extract ONLY the fields in the schema for the "${resolvedForm}" form. Combine details across all pages/images. Return valid JSON matching the schema.`;

    const mediaParts = params.files.map((file) => ({
      inlineData: {
        mimeType: file.mimeType,
        data: file.base64Data,
      },
    }));

    const response = await ai.models.generateContent({
      model: params.model,
      contents: {
        parts: [...mediaParts, { text: prompt }],
      },
      config: {
        systemInstruction,
        abortSignal: params.signal,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    const rawText = (response.text ?? '{}').trim();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new Error('AI returned an unreadable response while parsing the document.');
    }

    const sanitized = sanitizeExtractedFields(resolvedForm, parsed);
    const filledKeys = countFilledKeys(sanitized);

    return {
      mode: 'single',
      formType: resolvedForm,
      fields: sanitized,
      extractedSummary: `Extracted ${filledKeys} field${filledKeys === 1 ? '' : 's'} from document`,
    };
  } catch (err) {
    throw formatGeminiError(err);
  }
}

export async function extractAllA4FormsFromDocument(params: ExtractionOptions): Promise<{
  mode: 'allA4';
  marketValueMode: 'mvOpen' | 'mvHouse';
  forms: {
    ccCopy: Record<string, unknown>;
    mvOpen: Record<string, unknown>;
    mvHouse: Record<string, unknown>;
    ec: Record<string, unknown>;
  };
  extractedSummary: string;
}> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey });

  try {
    const combinedSchema = {
      type: Type.OBJECT,
      properties: {
        marketValueMode: {
          type: Type.STRING,
          description:
            'Choose "mvHouse" if the document describes a house/building/flat with built-up or plinth area (R.C.C., Tinshed, B.Tiles, Sq.ft) or bearing H.No. of an existing house; otherwise choose "mvOpen" for an open plot / house site / land.',
        },
        ccCopy: getCcCopySchema(),
        mvOpen: getMvOpenSchema(),
        mvHouse: getMvHouseSchema(),
        ec: getEcSchema(),
      },
    };

    const systemInstruction = [
      'You are a precision data extraction assistant for Indian (Telangana Registration & Stamps / CARD) property application forms.',
      'Read all visible text, tables, handwritten notes, stamps, Telugu-transliterated English names, survey numbers, house numbers, plinth areas, document numbers, link documents, boundaries, and mobile numbers across ALL attached PDFs and/or images (which may be multiple pages of the same deed or multiple related documents).',
      'Combine relevant information across all attached pages/images accurately.',
      'Populate ONLY the fields defined in the schema for the three applications: Certified Copy (ccCopy), Market Value (mvOpen if vacant/open plot OR mvHouse if residential house/building with plinth area), and EC Application (ec).',
      'Only extract values clearly present or directly derivable from the uploaded files. Never fabricate or assume missing court names, districts, villages, phone numbers, page numbers, or addresses.',
      'For party names across all three applications (fromNameAddress, executantNameAddress, claimantNameAddress, plaintiffNameAddress, applicantNameAddress, applicantName, belongsTo): extract ONLY the first/primary person name in uppercase without S/O, W/O, D/O, age, occupation, Aadhaar, address, or co-parties. Use relationType and relationLine (or plaintiffRelationType and plaintiffRelationLine for Market Value) for relation, and in residenceAddress / plaintiffResidenceAddress extract ONLY the village/town name in uppercase (no H.No., street, colony, mandal, district, or R/O prefix).',
      'Leave unmentioned fields as "" (or [] for arrays, false for includeAgriculturalLands when no agricultural land is present).',
    ].join(' ');

    const prompt = `Read all ${params.files.length} attached property document/image file(s) and extract ONLY the fields present in Certified Copy (ccCopy), Market Value (mvOpen or mvHouse depending on whether it is a vacant plot or residential house), and EC Application (ec). Combine details across all pages/images. Return valid JSON matching the schema.`;

    const mediaParts = params.files.map((file) => ({
      inlineData: {
        mimeType: file.mimeType,
        data: file.base64Data,
      },
    }));

    const response = await ai.models.generateContent({
      model: params.model,
      contents: {
        parts: [...mediaParts, { text: prompt }],
      },
      config: {
        systemInstruction,
        abortSignal: params.signal,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: combinedSchema,
      },
    });

    const rawText = (response.text ?? '{}').trim();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      throw new Error('AI returned an unreadable response while parsing the document.');
    }

    const mvMode: 'mvOpen' | 'mvHouse' =
      parsed.marketValueMode === 'mvHouse' ? 'mvHouse' : 'mvOpen';

    const ccCopy = sanitizeExtractedFields(
      'ccCopy',
      ((parsed.ccCopy as Record<string, unknown>) || {})
    );
    const mvOpen = sanitizeExtractedFields(
      'mvOpen',
      ((parsed.mvOpen as Record<string, unknown>) || {})
    );
    const mvHouse = sanitizeExtractedFields(
      'mvHouse',
      ((parsed.mvHouse as Record<string, unknown>) || {})
    );
    const ec = sanitizeExtractedFields(
      'ec',
      ((parsed.ec as Record<string, unknown>) || {})
    );

    const activeMvFields = mvMode === 'mvHouse' ? mvHouse : mvOpen;
    const totalCount =
      countFilledKeys(ccCopy) +
      countFilledKeys(activeMvFields) +
      countFilledKeys(ec);

    return {
      mode: 'allA4',
      marketValueMode: mvMode,
      forms: {
        ccCopy,
        mvOpen,
        mvHouse,
        ec,
      },
      extractedSummary: `Filled Certified Copy, Market Value (${
        mvMode === 'mvHouse' ? 'Residential' : 'Vacant Plot'
      }), and EC Application (${totalCount} fields read)`,
    };
  } catch (err) {
    throw formatGeminiError(err);
  }
}
