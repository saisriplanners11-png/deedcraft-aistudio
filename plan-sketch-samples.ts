export interface SampleManualSketch {
  id: string;
  title: string;
  teluguTitle: string;
  description: string;
  dataUrl: string;
  expectedData: {
    northDim: string;
    southDim: string;
    eastDim: string;
    westDim: string;
    roadSides: ('North' | 'South' | 'East' | 'West')[];
    roadWidth: string;
    roadLayoutType: string;
    northBoundary: string;
    southBoundary: string;
    eastBoundary: string;
    westBoundary: string;
    propertyType: string;
    areaSqYards: number;
    house?: {
      enabled: boolean;
      widthFeet: number;
      lengthFeet: number;
      structureType: string;
    };
  };
}

// Helper to encode SVG string to data URL
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const SAMPLE_1_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="460" viewBox="0 0 600 460" style="background:#fcfbf7; font-family:'Comic Sans MS', cursive, sans-serif;">
  <!-- Grid Lines to simulate engineering graph paper -->
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e6e1d6" stroke-width="0.8"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
  
  <!-- Sketch Header -->
  <text x="300" y="32" font-size="16" font-weight="bold" fill="#1e293b" text-anchor="middle">ROUGH SITE PLAN / చేతితో గీసిన ప్లాన్</text>
  <text x="300" y="50" font-size="12" fill="#475569" text-anchor="middle">PLOT NO. 15, SY NO. 240, HYDERABAD</text>

  <!-- North Arrow Hand-drawn style -->
  <g transform="translate(530, 70)">
    <circle cx="0" cy="0" r="22" fill="#ffffff" stroke="#0f172a" stroke-width="1.8"/>
    <path d="M 0 -18 L 6 10 L 0 4 L -6 10 Z" fill="#dc2626" stroke="#0f172a" stroke-width="1.2"/>
    <text x="0" y="-24" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">N / ఉ</text>
  </g>

  <!-- Plot Boundary (Hand drawn lines with slight organic jitter) -->
  <polygon points="150,90 450,90 450,330 150,330" fill="#fef9c3" fill-opacity="0.45" stroke="#1e293b" stroke-width="2.8" stroke-linejoin="round"/>
  
  <!-- North Boundary text & measurement -->
  <text x="300" y="80" font-size="14" font-weight="bold" fill="#b91c1c" text-anchor="middle">NORTH / ఉత్తరం: 40'-0"</text>
  <text x="300" y="112" font-size="12" fill="#334155" text-anchor="middle">Plot No. 24 (శ్రీమతి లక్ష్మి ల్యాండ్)</text>

  <!-- South Boundary & Road -->
  <rect x="90" y="330" width="420" height="65" fill="#e2e8f0" stroke="#334155" stroke-width="2" stroke-dasharray="8,5"/>
  <line x1="90" y1="362" x2="510" y2="362" stroke="#64748b" stroke-width="1.8" stroke-dasharray="10,6"/>
  <text x="300" y="322" font-size="14" font-weight="bold" fill="#b91c1c" text-anchor="middle">SOUTH / దక్షిణం: 40'-0"</text>
  <text x="300" y="368" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle">30'-0" WIDE PANCHAYAT ROAD (30 అడుగుల రోడ్డు)</text>

  <!-- East Boundary -->
  <text x="460" y="210" font-size="14" font-weight="bold" fill="#b91c1c" transform="rotate(90, 460, 210)" text-anchor="middle">EAST / తూర్పు: 60'-0"</text>
  <text x="485" y="210" font-size="12" fill="#334155" transform="rotate(90, 485, 210)" text-anchor="middle">Plot No. 16</text>

  <!-- West Boundary -->
  <text x="140" y="210" font-size="14" font-weight="bold" fill="#b91c1c" transform="rotate(-90, 140, 210)" text-anchor="middle">WEST / పడమర: 60'-0"</text>
  <text x="115" y="210" font-size="12" fill="#334155" transform="rotate(-90, 115, 210)" text-anchor="middle">Plot No. 14 (వెంకటేశ్వర్లు)</text>

  <!-- Inside House Structure (R.C.C. House) -->
  <rect x="210" y="140" width="180" height="150" fill="#fed7aa" stroke="#c2410c" stroke-width="2.2" stroke-dasharray="4,2"/>
  <text x="300" y="210" font-size="13" font-weight="bold" fill="#9a3412" text-anchor="middle">R.C.C. SLAB HOUSE</text>
  <text x="300" y="228" font-size="11" fill="#9a3412" text-anchor="middle">24' x 30' (Plinth: 720 Sq.Ft)</text>
  
  <!-- Setbacks -->
  <text x="300" y="132" font-size="10" fill="#0369a1" text-anchor="middle">Setback: 3'-0"</text>
  <text x="300" y="306" font-size="10" fill="#0369a1" text-anchor="middle">Setback: 5'-0"</text>

  <!-- Area Calculation note -->
  <g transform="translate(160, 415)">
    <rect x="0" y="0" width="280" height="34" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2"/>
    <text x="140" y="16" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle">AREA: 40' x 60' / 9 = 266.66 Sq.Yards</text>
    <text x="140" y="29" font-size="10" fill="#475569" text-anchor="middle">(222.96 Sq.Metres / గజములు)</text>
  </g>
</svg>`;

const SAMPLE_2_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="460" viewBox="0 0 600 460" style="background:#fbfbfb; font-family:'Comic Sans MS', cursive, sans-serif;">
  <defs>
    <pattern id="grid2" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.8"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid2)" />

  <text x="300" y="32" font-size="16" font-weight="bold" fill="#0f172a" text-anchor="middle">CORNER PLOT WITH T-JUNCTION / కార్నర్ ప్లాట్ డ్రాయింగ్</text>

  <!-- North Arrow -->
  <g transform="translate(530, 65)">
    <circle cx="0" cy="0" r="20" fill="#ffffff" stroke="#0f172a" stroke-width="1.5"/>
    <path d="M 0 -16 L 5 8 L 0 3 L -5 8 Z" fill="#dc2626"/>
    <text x="0" y="-20" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle">N</text>
  </g>

  <!-- Plot Boundary -->
  <polygon points="170,100 430,100 430,310 170,310" fill="#dcfce7" fill-opacity="0.5" stroke="#15803d" stroke-width="2.8"/>

  <!-- North Dimension -->
  <text x="300" y="90" font-size="13" font-weight="bold" fill="#b91c1c" text-anchor="middle">NORTH / ఉత్తరం: 35'-0"</text>
  <text x="300" y="122" font-size="11" fill="#334155" text-anchor="middle">Plot No. 8</text>

  <!-- East Dimension & Road -->
  <rect x="430" y="60" width="70" height="350" fill="#f1f5f9" stroke="#475569" stroke-width="1.8" stroke-dasharray="6,4"/>
  <text x="420" y="200" font-size="13" font-weight="bold" fill="#b91c1c" transform="rotate(90, 420, 200)" text-anchor="middle">EAST / తూర్పు: 50'-0"</text>
  <text x="470" y="200" font-size="12" font-weight="bold" fill="#1e293b" transform="rotate(90, 470, 200)" text-anchor="middle">33'-0" WIDE ROAD (తూర్పు రోడ్డు)</text>

  <!-- South Dimension & Road with T-Junction opposite -->
  <rect x="100" y="310" width="400" height="60" fill="#f1f5f9" stroke="#475569" stroke-width="1.8" stroke-dasharray="6,4"/>
  <!-- T-Junction stem coming into the road -->
  <rect x="250" y="370" width="70" height="50" fill="#f1f5f9" stroke="#475569" stroke-width="1.8" stroke-dasharray="6,4"/>
  <text x="285" y="405" font-size="10" font-weight="bold" fill="#0369a1" text-anchor="middle">T-ROAD 30'</text>

  <text x="300" y="302" font-size="13" font-weight="bold" fill="#b91c1c" text-anchor="middle">SOUTH / దక్షిణం: 35'-0"</text>
  <text x="210" y="345" font-size="12" font-weight="bold" fill="#1e293b" text-anchor="middle">40'-0" WIDE ROAD</text>

  <!-- West Dimension -->
  <text x="160" y="200" font-size="13" font-weight="bold" fill="#b91c1c" transform="rotate(-90, 160, 200)" text-anchor="middle">WEST / పడమర: 50'-0"</text>
  <text x="135" y="200" font-size="11" fill="#334155" transform="rotate(-90, 135, 200)" text-anchor="middle">Land of R. Sharma</text>

  <text x="300" y="205" font-size="14" font-weight="bold" fill="#166534" text-anchor="middle">OPEN PLOT NO. 9</text>
  <text x="300" y="225" font-size="12" fill="#166534" text-anchor="middle">Area: 194.44 Sq.Yards</text>
</svg>`;

export const SAMPLE_MANUAL_SKETCHES: SampleManualSketch[] = [
  {
    id: 'sample-plot-house',
    title: 'Hand-Drawn Plot with House & 30ft Road',
    teluguTitle: 'చేతితో గీసిన ప్లాన్ + ఇల్లు (40x60 అడుగులు)',
    description: 'Pencil drawing of 40x60 plot with 30ft South road, R.C.C. building footprint, and setbacks.',
    dataUrl: svgToDataUrl(SAMPLE_1_SVG),
    expectedData: {
      northDim: "40'-0\"",
      southDim: "40'-0\"",
      eastDim: "60'-0\"",
      westDim: "60'-0\"",
      roadSides: ['South'],
      roadWidth: "30'-0\"",
      roadLayoutType: 'One Side Road',
      northBoundary: 'Plot No. 24 (శ్రీమతి లక్ష్మి ల్యాండ్)',
      southBoundary: '30\'-0" WIDE PANCHAYAT ROAD',
      eastBoundary: 'Plot No. 16',
      westBoundary: 'Plot No. 14 (వెంకటేశ్వర్లు)',
      propertyType: 'House',
      areaSqYards: 266.67,
      house: {
        enabled: true,
        widthFeet: 24,
        lengthFeet: 30,
        structureType: 'R.C.C. Roof Slab',
      },
    },
  },
  {
    id: 'sample-corner-tjunction',
    title: 'Corner Plot with T-Junction Road',
    teluguTitle: 'కార్నర్ ప్లాట్ + ఎదురు రోడ్డు / T-జంక్షన్ (35x50)',
    description: 'Corner plot with East 33ft road, South 40ft road, and T-junction approach stem opposite.',
    dataUrl: svgToDataUrl(SAMPLE_2_SVG),
    expectedData: {
      northDim: "35'-0\"",
      southDim: "35'-0\"",
      eastDim: "50'-0\"",
      westDim: "50'-0\"",
      roadSides: ['South', 'East'],
      roadWidth: "40'-0\"",
      roadLayoutType: 'T-Junction',
      northBoundary: 'Plot No. 8',
      southBoundary: '40\'-0" WIDE ROAD',
      eastBoundary: '33\'-0" WIDE ROAD',
      westBoundary: 'Land of R. Sharma',
      propertyType: 'Plot',
      areaSqYards: 194.44,
    },
  },
];
