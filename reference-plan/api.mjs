import express from 'express';
import { GoogleGenAI } from '@google/genai';


let aiClient = null;
function getGenAI() {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export function createReferencePlanApi() {
  const app = express();
  // Use port from environment (Cloud Run assigns PORT, e.g. 8080), fallback to 3000 in dev

  // Middleware for parsing JSON with generous limit for base64 sketches and photos
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Analyze Hand-Drawn / Manual Sketch Plan using Gemini 3.8 Flash Vision
  app.post('/api/analyze-sketch', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg' } = req.body;

      if (!imageBase64) {
        return res.status(400).json({
          error: 'Image data is required (చిత్రం వివరాలు అవసరం).',
        });
      }

      // Clean base64 string if data URL prefix was included
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z0-9.+]+;base64,/, '');

      const ai = getGenAI();

      const prompt = `You are an expert architectural property-sketch digitization and cadastral map redrawing specialist (specializing in Indian land registration deeds, Sub-Registrar technical cadastral sketches, municipal layout plans, and village panchayat plans).

YOUR PRIMARY RULE:
REDRAW AND EXTRACT THE UPLOADED PROPERTY SKETCH EXACTLY AS IT APPEARS IN THE SOURCE IMAGE.
DO NOT REDESIGN, REINTERPRET, CORRECT, MODIFY, ASSUME, OR ADD ANY PROPERTY INFORMATION.
ACCURACY IS MORE IMPORTANT THAN BEAUTIFICATION. FAITHFUL REPRODUCTION IS MORE IMPORTANT THAN DESIGN.

STRICT ACCURACY REQUIREMENTS TO FOLLOW:
1. PRESERVE THE ORIGINAL GEOMETRY & ORIENTATION:
   - Keep the exact shape and orientation of the plot.
   - Keep the exact location, size, and position of the house/building structure.
   - Keep all roads, corner roads, and open spaces exactly as shown.
   - Identify North direction compass arrow orientation (0-359 degrees).

2. PRESERVE EVERY DIMENSION EXACTLY AS WRITTEN:
   - Read every visible dimension from the source image.
   - Reproduce dimensions in their exact original format (e.g. "26'", "33'", "54'-6\"", "24'-6\"", "21'-9\"", "21'-6\"", "4'", "3'-2\"", "20'", "18\"", "40.5'").
   - DO NOT calculate or replace dimensions.
   - DO NOT convert feet into meters or inches into feet.
   - DO NOT round numbers or infer missing measurements.
   - If any measurement is unclear, flag it or leave unchanged rather than guessing.

3. PRESERVE ALL TEXT VIA EXACT OCR:
   - Reproduce all clearly visible printed or handwritten text exactly:
     * Property / House owner name (e.g. "NAKKA SUBBAYAH", "GADDAM RAMULU")
     * House number / Door number (e.g. "4-5-101", "6-5-48/2", "1-45")
     * Survey / Plot references (e.g. "Plot No. 24", "Sy No. 508/B")
     * Street / Road names & widths (e.g. "EAST: 12' WIDE ROAD", "30'-0\" WIDE ROAD")
     * Boundary descriptions exactly as written (e.g. "HOUSE OF NAKKA SUBBAYAH", "HOUSE OF GADDAM ARAVAH", "HOUSE OF GADDAM RAMULU")
     * Locality, village, mandal, district names
     * Specification box values (TOTAL PLOT AREA, EQ. TO, TILED PLINTH AREA, RCC PLINTH AREA)
   - Do NOT paraphrase, translate, autocorrect, or replace boundary names with generic terms.

4. NORTH / DIRECTION SYMBOL:
   - Detect the compass arrow orientation and rotation angle (0° = North at top, 90° = North at right, 180° = North at bottom, 270° = North at left, or intermediate angles like 45°, 315°).
   - Style: "cadastral", "compass", "architectural", or "minimal".

5. BOUNDARIES:
   - Preserve every boundary exactly as visible in the source.

6. BUILDING / HOUSE DETAILS:
   - If the source shows a house (e.g. "TILED ROOF HOUSE", "RCC BUILDING", "H.NO.4-5-101", 20' x 20'), preserve the exact building outline, text, dimensions, and position.

7. SPECIFICATION BOX:
   - Extract Total Plot Area in Sq. Yards, Sq. Meters, Sq. Feet, and Plinth Area with exact units.

8. NO INVENTION:
   - NEVER invent missing dimensions, boundaries, property numbers, owner names, road widths, or areas.

Return ONLY a valid JSON object matching this structure:
{
  "northDim": "40'-0\"",
  "southDim": "40'-0\"",
  "eastDim": "60'-0\"",
  "westDim": "60'-0\"",
  "dimensionUnit": "Feet",
  "northBoundary": "HOUSE OF NAKKA SUBBAYAH",
  "southBoundary": "EAST: 12' WIDE ROAD",
  "eastBoundary": "HOUSE OF GADDAM RAMULU",
  "westBoundary": "HOUSE OF GADDAM ARAVAH",
  "roadSides": ["South"],
  "roadWidth": "12'-0\"",
  "roadLayoutType": "One Side Road",
  "northRotation": 0,
  "northSymbolStyle": "cadastral",
  "propertyType": "House",
  "areaSqYards": 266.67,
  "areaSqMtrs": 222.97,
  "surveyNo": "",
  "plotNo": "",
  "houseNo": "4-5-101",
  "ownerName": "NAKKA SUBBAYAH",
  "houseAuthority": "Municipal Council House No.",
  "locationTemplateType": "bearing_only",
  "nearHNo": "",
  "locality": "",
  "village": "",
  "mandal": "",
  "district": "",
  "house": {
    "enabled": true,
    "widthFeet": 20,
    "lengthFeet": 20,
    "widthRaw": "20'-0\"",
    "lengthRaw": "20'-0\"",
    "structureType": "Tiled Roof House",
    "roofType": "Tiled Roof",
    "plinthPrefix": "Tiled",
    "plinthAreaSqFt": 400,
    "plinthAreaSqYds": 44.44,
    "setbackNorth": "",
    "setbackSouth": "",
    "setbackEast": "",
    "setbackWest": ""
  },
  "summaryNotes": "Cadastral reproduction of uploaded sketch with faithful geometry, exact boundaries, and zero invented values."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType || 'image/jpeg',
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1, // low temperature for precise factual extraction
        },
      });

      const responseText = response.text || '{}';
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        // In case there is markdown wrapper
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedData = JSON.parse(cleaned);
      }

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (error) {
      console.error('Error analyzing manual sketch:', error);
      let errMsg = error?.message || 'Failed to process sketch drawing.';
      if (errMsg.includes('resource_exhausted') || errMsg.includes('quota') || errMsg.includes('Exceeded current quota')) {
        errMsg = 'Gemini API quota exceeded (API కోటా ముగిసింది). Please check your Gemini API billing/quota or enter plan details manually.';
      }
      return res.status(500).json({
        success: false,
        error: errMsg,
      });
    }
  });

  // Parse Property Deed / Document (Word, DOCX, DOC, PDF, TXT, Images) using Gemini 3.8 Flash
  app.post('/api/parse-document', async (req, res) => {
    try {
      const { fileBase64, mimeType = 'application/pdf', textContent } = req.body;

      if (!fileBase64 && !textContent) {
        return res.status(400).json({
          error: 'Document file or text is required (డ్యాక్యుమెంట్ లేదా టెక్స్ట్ అవసరం).',
        });
      }

      const ai = getGenAI();
      const prompt = `You are an expert Indian land registration officer, legal deed analyst, and cadastral surveyor (specializing in Telangana & Andhra Pradesh Sale Deeds, Partition Deeds, Gift Deeds, Settlement Deeds, Open Plot/House property documents in English and Telugu).

Carefully read and analyze the provided property document text or file. Extract all property details, HOUSE NUMBERS, ALL EXECUTANTS / SELLERS, ALL CLAIMANTS / PURCHASERS, and boundary details with 100% precision so they auto-fill seamlessly into a property plan generator.

Return ONLY a valid JSON object matching this exact structure:
{
  "northDim": "40'-0\"",
  "southDim": "40'-0\"",
  "eastDim": "60'-0\"",
  "westDim": "60'-0\"",
  "dimensionUnit": "Feet",
  "northBoundary": "Plot No. 24",
  "southBoundary": "30'-0\" Wide Road",
  "eastBoundary": "Plot No. 12",
  "westBoundary": "Neighbour's Property",
  "roadSides": ["South"],
  "roadWidth": "30'-0\"",
  "roadLayoutType": "One Side Road",
  "tJunctionSide": "South",
  "propertyType": "Plot",
  "areaSqYards": 266.67,
  "areaSqMtrs": 222.97,
  "surveyNo": "",
  "plotNo": "",
  "houseNo": "",
  "houseAuthority": "Municipal Council House No.",
  "locationTemplateType": "near_adjacent_hno",
  "nearHNo": "",
  "executants": [
    {
      "name": "Full Legal Name of Executant 1 / Seller 1",
      "relation": "S/o",
      "relativeName": "Father / Husband Name",
      "age": "45",
      "occupation": "Business",
      "address": "Full Residential Address"
    }
  ],
  "claimants": [
    {
      "name": "Full Legal Name of Claimant 1 / Purchaser 1",
      "relation": "S/o",
      "relativeName": "Father / Husband Name",
      "age": "38",
      "occupation": "Employee",
      "address": "Full Residential Address"
    }
  ],
  "locality": "",
  "village": "",
  "mandal": "",
  "district": "",
  "house": {
    "enabled": false,
    "widthFeet": 25,
    "lengthFeet": 35,
    "structureType": "R.C.C. Roof Slab",
    "roofType": "R.C.C. Slab",
    "plinthPrefix": "R.C.C.",
    "plinthAreaSqFt": 0,
    "plinthAreaSqYds": 0,
    "setbackNorth": "3'-0\"",
    "setbackSouth": "5'-0\"",
    "setbackEast": "4'-0\"",
    "setbackWest": "3'-0\""
  },
  "summaryNotes": "Extracted successfully from uploaded document."
}

CRITICAL RULES FOR ACCURATE EXTRACTION:
1. "executants" (Array of all Executant / Seller / Vendor / Donor / Transferor parties):
   - In Indian deeds, there can be 1, 2, 3, 4, or more joint sellers, co-owners, or legal heirs executing the deed together.
   - Extract EVERY SINGLE executant / seller mentioned in the deed into the "executants" array. DO NOT omit any executant.
   - For EACH person, extract:
     * "name": Full legal name in clean format.
     * "relation": Must be one of "S/o", "W/o", "D/o", "C/o", or "Rep. by".
     * "relativeName": Father's / Husband's / Representative's full name.
     * "age": Age in years as a string (e.g. "45", "52", "38").
     * "occupation": Occupation (e.g. "Agriculture", "Business", "Housewife", "Private Service", "Employee", "Real Estate").
     * "address": Full residential address with H.No, locality, village/town, mandal, district.

2. "claimants" (Array of all Claimant / Purchaser / Vendee / Donee / Transferee parties):
   - In Indian deeds, there can be 1, 2, 3, or more joint purchasers/claimants (e.g. husband and wife, co-purchasers, business partners).
   - Extract EVERY SINGLE claimant / purchaser mentioned in the deed into the "claimants" array. DO NOT omit any claimant.
   - For EACH person, extract:
     * "name": Full legal name in clean format.
     * "relation": Must be one of "S/o", "W/o", "D/o", "C/o", or "Rep. by".
     * "relativeName": Father's / Husband's / Representative's full name.
     * "age": Age in years as a string.
     * "occupation": Occupation.
     * "address": Full residential address.

3. "house" and "houses" - HOUSE PLINTH AREA & STRUCTURE MEASUREMENTS (CRITICAL ACCURACY):
   - Search the document thoroughly for ANY mention of House / Building Plinth Area, Built-up area, or Structure details in English or Telugu:
     * "Plinth area of RCC building: 1172.00 sq.ft" -> plinthAreaSqFt: 1172.00, plinthPrefix: "R.C.C.", structureType: "R.C.C. Building"
     * "Plinth area of R.C.C. roofed house: 1172.00 square feets" (or 1172 sft / sq.ft / sq.feet) -> plinthAreaSqFt: 1172.00
     * "ప్లింత్ ఏరియా / నిర్మిత విస్తీర్ణం: 1172.00 చదరపు అడుగులు (లేదా 1172 చ.అ.)" -> plinthAreaSqFt: 1172.00
     * "Plinth Area of A.C. Sheet: 450.00 sq.ft" -> plinthAreaSqFt: 450.00, plinthPrefix: "A.C. Sheet", structureType: "A.C. Sheet House"
     * "Plinth Area of Tiled House: 600.00 sq.ft" -> plinthAreaSqFt: 600.00, plinthPrefix: "Tiled", structureType: "Tiled House"
     * "Plinth Area of Thatched / Hut / Shed: 250.00 sq.ft" -> plinthAreaSqFt: 250.00, plinthPrefix: "Shed"
     * Multi-floor or multi-structure deeds (e.g. "Ground Floor Plinth Area: 850 Sq.Ft, First Floor: 850 Sq.Ft"): extract both structures into "houses" array with individual plinthAreaSqFt and structureType.
   - Extract the EXACT numeric value of "plinthAreaSqFt" (e.g., 1172.00, 850.50, 450.00, 1420.00). DO NOT invent or round off values if written in the document.
   - Calculate "plinthAreaSqYds" = plinthAreaSqFt / 9 (rounded to 2 decimal places).
   - If house dimensions (width x length) are given (e.g., 28'-0" x 41'-10" or 24' x 36'), extract "widthFeet" and "lengthFeet". If dimensions are not explicitly mentioned but plinth area is given, estimate width & length that multiply to equal the plinth area (e.g. width = sqrt(plinthArea / 1.4), length = plinthArea / width).
   - If plinth area is mentioned, set "enabled": true in the "house" object.

4. "houseNo": 
   - Extract the EXACT clean House Number / Door Number / Assessment Number of the property (e.g., "6-5-48/2", "1-45", "12-4/A", "5-60", "3-45/1", "10-2-125/B", "4-12/1", "2-30").
   - Look for occurrences in both English and Telugu like:
     * "bearing Municipal Council House No. 6-5-48/2" -> houseNo: "6-5-48/2"
     * "bearing Gram Panchayat House No. 1-45/1" -> houseNo: "1-45/1"
     * "bearing House No. 12-4-50" or "H.No. 6-5-48/2" -> houseNo: "6-5-48/2"
     * "మున్సిపల్ కౌన్సిల్ హౌస్ నెం. 6-5-48/2" -> houseNo: "6-5-48/2"
     * "గ్రామ పంచాయతీ హౌస్ నెం. 1-45/1" or "గృహ నెం." / "డోర్ నెం." -> houseNo: "1-45/1"
     * "dismantled house bearing H.No. 3-45" or "కూల్చిన పాత ఇల్లు హౌస్ నెం." -> houseNo: "3-45"
     * "open place bearing H.No. 4-12 (PART)" -> houseNo: "4-12"
     * "Near H.No. 5-60", "Adjacent H.No. 1-22", "Opposite H.No. 4-15", "Near/Adjacent H.No. 9-7-8" -> houseNo: "5-60", "1-22", "4-15", "9-7-8"
   - Extract ONLY the alphanumeric door/house number without leading prefix strings like "H.No.", "Door No.", "D.No.", "Bearing", "నెం.", etc.

5. "houseAuthority":
   - Identify the administering local authority:
     * "Municipal Council House No." (if Municipality / Municipal Council or మున్సిపల్ కౌన్సిల్)
     * "Gram Panchayat House No." (if Gram Panchayat or గ్రామ పంచాయతీ)
     * "Municipal Corporation House No." (if Municipal Corporation / GHMC or మున్సిపల్ కార్పొరేషన్)
     * "House No." or "H.No."

6. "locationTemplateType":
   - If it's a House with bearing H.No and Plot No: "bearing_and_plot"
   - If it's a House with bearing H.No only: "bearing_only"
   - If it's an Open Plot with plot number only: "plot_only"
   - If it's land with survey number only: "survey_only"
   - If it's Open Plot near landmark H.No: "near_adjacent_hno", "near_hno", "adjacent_hno", "opp_hno", or "beside_hno"
   - If it's Open Place bearing H.No (PART): "part_open_place_hno"
   - If it's Dismantled / Demolished house: "demolished_house_hno"

7. "propertyType": 
   - Must be one of "Plot", "House", "Open Place", "Commercial Building", "Agricultural Land", "Demolished House", "Part Open Place", "Flat", or "Other".
   - If the document mentions "dismantled house", "dismantled house bearing", "demolished house", "old house", set "propertyType" to "Demolished House".
   - If the document mentions "open place bearing H.No ... (PART)" or "(PART)", set "propertyType" to "Part Open Place".
   - If the document conveys a residential/commercial house, RCC building, or tiled house, set "propertyType" to "House" and enable the "house" object with plinth area details if specified.

8. "surveyNo" & "plotNo":
   - "surveyNo": Extract Survey Number (e.g. "508/B", "125/A", "45") ONLY IF explicitly present in the document. Otherwise leave "".
   - "plotNo": Extract Plot Number (e.g. "20", "45", "12/Part") ONLY IF explicitly present in the document. Otherwise leave "".

9. "nearHNo":
   - Full textual description string matching deed wording (e.g. "bearing Municipal Council House No.6-5-48/2 and in plot no.20", "bearing dismantled house H.No.3-45", "bearing H.No.4-12 (PART)", "NEAR/ADJACENT H.NO.5-60").

10. "areaSqYards" & "areaSqMtrs":
   - Numeric area in square yards (e.g. 572.00, 266.67). If square feet given, divide by 9. If sq.mtrs given, convert to sq.yards (sq.mtrs * 1.19599).

11. "northDim", "southDim", "eastDim", "westDim", "northBoundary", "southBoundary", "eastBoundary", "westBoundary":
   - Extract 4 sides dimensions (e.g. "40'-0\"", "60'-0\"") and neighbor / road descriptions.`;

      let parts = [];
      if (textContent) {
        parts.push({ text: `Document Text Content:\n${textContent}\n\n${prompt}` });
      } else if (fileBase64) {
        const cleanBase64 = fileBase64.replace(/^data:[a-z0-9/+.#-]+;base64,/, '');
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || 'application/pdf',
          },
        });
        parts.push({ text: prompt });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '{}';
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedData = JSON.parse(cleaned);
      }

      return res.json({
        success: true,
        data: parsedData,
      });
    } catch (error) {
      console.error('Error parsing document:', error);
      let errMsg = error?.message || 'Failed to parse document.';
      if (errMsg.includes('resource_exhausted') || errMsg.includes('quota') || errMsg.includes('Exceeded current quota')) {
        errMsg = 'Gemini API quota exceeded (API కోటా ముగిసింది). Please check your Gemini API billing/quota or enter document details manually.';
      }
      return res.status(500).json({
        success: false,
        error: errMsg,
      });
    }
  });

  return app;
}
