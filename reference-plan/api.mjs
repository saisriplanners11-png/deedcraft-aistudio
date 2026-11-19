import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { logGeminiExtraction, withGeminiMedia } from '../gemini-media.mjs';
import { planDocumentContract, verifiedPlanDocument } from './document-evidence.mjs';


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

async function generateContent(ai, request, res, task) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnect);
  try {
    return await withGeminiMedia(request, {
      apiKey: process.env.GEMINI_API_KEY, signal: controller.signal,
      send: async body => {
        const started = performance.now();
        let status = 200;
        let usage;
        try {
          const result = await ai.models.generateContent({ ...body, config: { ...body.config, abortSignal: controller.signal } });
          usage = result.usageMetadata;
          return result;
        } catch (error) {
          status = Number(error.status) || 502;
          throw error;
        } finally {
          if (task) logGeminiExtraction(task, started, status, usage);
        }
      },
    });
  } finally { clearTimeout(timer); res.off('close', disconnect); }
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

      const response = await generateContent(ai, {
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
      }, res);

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

  // Parse a deed uploaded to the property or party form.
  app.post('/api/parse-document', async (req, res) => {
    const { fileBase64, mimeType = 'application/pdf', textContent, scope = 'both' } = req.body || {};
    const text = typeof textContent === 'string' ? textContent.trim() : '';
    if (!['both', 'property', 'parties'].includes(scope)) {
      return res.status(400).json({ success: false, error: 'Choose property or parties for document extraction.' });
    }
    if (!text && (typeof fileBase64 !== 'string' || !fileBase64.trim())) {
      return res.status(400).json({ success: false, error: 'Choose a readable document or image.' });
    }

    try {
      const ai = getGenAI();
      const contract = planDocumentContract(scope);
      const source = text ? { text } : {
        inlineData: { data: fileBase64.replace(/^data:[a-z0-9/+.#-]+;base64,/i, ''), mimeType },
      };
      const model = process.env.GEMINI_EXTRACT_MODEL || process.env.GEMINI_MODEL || 'gemini-3.8-flash';
      const read = async (instruction, verification = false) => {
        const response = await generateContent(ai, {
          model,
          contents: { parts: [source, { text: instruction }] },
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: contract.schema,
            systemInstruction: contract.task,
            maxOutputTokens: 8000,
            ...((!verification || text) && ['gemini-3.6-flash', 'gemini-3.8-flash'].includes(model)
              ? { thinkingConfig: { thinkingLevel: 'LOW' } } : {}),
          },
        }, res, 'plan-document');
        if (!response.text || response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
          throw new Error('The document could not be read completely. Upload the relevant pages or a clearer copy.');
        }
        return JSON.parse(response.text);
      };
      const [first, second] = await Promise.all([
        read('Copy the requested supported facts and their exact source words.'),
        read('Independently read the requested facts and quote the original evidence for each one.', true),
      ]);
      const data = verifiedPlanDocument(first, second, text, scope);
      if (!Object.keys(data).length) {
        return res.status(422).json({ success: false, error: 'No details could be independently verified. Try a clearer source or enter the details directly.' });
      }
      return res.json({ success: true, data });
    } catch (error) {
      if (res.destroyed) return;
      const quota = Number(error?.status) === 429 || /quota|resource_exhausted/i.test(error?.message ?? '');
      return res.status(quota ? 429 : 502).json({
        success: false,
        error: quota ? 'Gemini reached its request or token quota. Retry when quota is available.'
          : 'The plan document could not be verified. Retry or upload the relevant pages.',
      });
    }
  });

  return app;
}
