// Local, deterministic browser QA. Proxies Vite; intercepts extraction so no paid AI call is made.
// Start Vite on 5174, run this file, open 5176 and choose Registration (Preview).
import { createServer, request } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const property = { propState: 'Telangana', district: 'HYDERABAD', mandal: 'HYDERABAD', village: 'HYDERABAD DIVISION', locality: 'ASHOK NAGAR-1', sro: 'CHIKKADPALLY', plotNo: '42', surveyNo: 'QA-100', extentSqYards: '240', category: 'Vacant Plot', unit: 'Sq. Yards', boundaryNorth: 'North neighbour', boundarySouth: 'Road', boundaryEast: 'East neighbour', boundaryWest: 'West neighbour' };
const person = (side, name) => Object.fromEntries(Object.entries({ Name: name, Relation: 'S/O', RelativeName: 'QA PARENT', Dob: '1990-01-01', Occupation: 'Teacher', HNo: 'QA-1', Locality: 'QA LOCALITY', Village: 'QA VILLAGE', Mandal: 'QA MANDAL', District: 'QA DISTRICT', State: 'Telangana', PinCode: '500001' }).map(([key, value]) => [side + key, value]));
const own = { linkDocType: 'Sale Deed', linkDocNo: 'QA-42/2020', linkDocDate: '2020-01-02', linkSro: 'HISTORIC TITLE OFFICE' };
const fixtures = {
  REGISTRATION_QA_DEED: { ...own, ...property },
  REGISTRATION_QA_SELLER_ONE: person('executant', 'QA SELLER ONE'),
  REGISTRATION_QA_SELLER_TWO: person('executant', 'QA SELLER TWO'),
  REGISTRATION_QA_BUYER: person('claimant', 'QA BUYER'),
};
for (const mode of ['rtgs', 'cheque', 'dd', 'upi', 'cash', 'housing-loan', 'through-bank']) {
  fixtures['REGISTRATION_QA_PAYMENT_' + mode.replaceAll('-', '_').toUpperCase()] = {
    amount: '10000', refNo: '123456789012', bank: 'QA BANK', branch: 'QA BRANCH',
    date: '2026-10-26', payer: 'QA BUYER', payee: 'QA SELLER ONE', detectedMode: mode, _unreadable: '',
  };
}
const out = new URL('../tmp/registration-qa/', import.meta.url);
await mkdir(out, { recursive: true });
const writeFixture = async (name, text) => { try { await writeFile(new URL(name, out), text, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; } };
// Do not rewrite files backing a live browser File object: it invalidates IndexedDB blobs.
for (const [key, values] of Object.entries(fixtures)) await writeFixture(key + '.txt', key + '\n' + Object.entries(values).map(([field, value]) => `${field}: ${value}`).join('\n'));
// The existing link-deed reader uses opening pages 1–2 and later schedule pages separately.
for (let page = 1; page <= 4; page++) await writeFixture(`REGISTRATION_QA_DEED_page${page}.txt`, 'REGISTRATION_QA_DEED\n' + Object.entries(fixtures.REGISTRATION_QA_DEED).map(([field, value]) => `${field}: ${value}`).join('\n'));
const port = Number(process.env.REGISTRATION_QA_PORT) || 5176;
const targetPort = Number(process.env.REGISTRATION_QA_TARGET_PORT) || 5174;
let calls = 0;
createServer(async (req, res) => {
  if (req.url === '/__registration_qa/status') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ calls })); }
  if (req.url?.startsWith('/api/anthropic/')) {
    try {
      let body = ''; for await (const chunk of req) body += chunk;
      const input = JSON.parse(body);
      const text = input.messages.flatMap(message => message.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n');
      const key = Object.keys(fixtures).find(key => text.includes(key));
      if (!key) throw new Error('QA received a document outside the synthetic fixture set.');
      const values = fixtures[key];
      if (input.output_config) {
        const allowed = input.output_config.format.schema.properties;
        const data = Object.fromEntries(Object.entries(values).filter(([field]) => Object.hasOwn(allowed, field)));
        calls++;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ id: 'registration_payment_qa', type: 'message', role: 'assistant', model: input.model, content: [{ type: 'text', text: JSON.stringify(data) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
      }
      const schema = input.tools?.[0]?.input_schema?.properties;
      if (!schema) throw new Error('QA received an unsupported extraction contract.');
      let data;
      if (schema.pages) data = { pages: [{ number: 1, text: key + '\n' + Object.entries(values).map(([field, value]) => `${field}: ${value}`).join('\n'), kind: 'deed', drawing: false }] };
      else if (schema.candidates) {
        const allowed = schema.candidates.items.properties.field.enum;
        data = { candidates: Object.entries(values).filter(([field]) => allowed.includes(field)).map(([field, value]) => ({ field, value, role: field.startsWith('executant') ? 'executant' : field.startsWith('claimant') ? 'claimant' : Object.hasOwn(own, field) ? 'link' : 'property', record: 'primary', quote: `${field}: ${value}`, region: 'Printed source label', page: 1, historical: false, handwritten: false })), plan: null, notes: [] };
      } else if (schema.regions) data = { regions: [], scale: '' };
      else data = { planVerified: true, issues: [] };
      calls++;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ id: 'registration_qa', type: 'message', role: 'assistant', model: input.model, content: [{ type: 'tool_use', id: 'qa_result', name: 'record_transcription', input: data }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
    } catch (error) { res.statusCode = 400; return res.end(JSON.stringify({ error: { message: error.message } })); }
  }
  const upstream = request({ hostname: '127.0.0.1', port: targetPort, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${targetPort}` } }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
  upstream.on('error', () => { res.statusCode = 502; res.end('Start the registration Vite preview on port 5174.'); });
  req.pipe(upstream);
}).listen(port, '127.0.0.1', () => console.log(`Fixture QA: http://127.0.0.1:${port} · synthetic uploads: ${fileURLToPath(out)}`));
