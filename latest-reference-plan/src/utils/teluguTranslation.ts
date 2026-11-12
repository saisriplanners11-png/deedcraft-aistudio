/**
 * Telugu conversion and transliteration utilities for registration plans
 */

// Common vocabulary dictionary for registration plans
const VOCABULARY_MAP: Record<string, string> = {
  // Common Places & Localities in Telangana / AP
  'SIRCILLA': 'సిరిసిల్ల',
  'RAJANNA SIRCILLA': 'రాజన్న సిరిసిల్ల',
  'RAJANNA': 'రాజన్న',
  'VIDYANAGAR': 'విద్యానగర్',
  'VIDYA NAGAR': 'విద్యానగర్',
  'RENUKANAGAR': 'రేణుకానగర్',
  'RENUKA NAGAR': 'రేణుకానగర్',
  'SUBHASH NAGAR': 'సుభాష్ నగర్',
  'SUBHASHNAGAR': 'సుభాష్ నగర్',
  'SHANTI NAGAR': 'శాంతి నగర్',
  'SHANTINAGAR': 'శాంతి నగర్',
  'GANDHI NAGAR': 'గాంధీ నగర్',
  'GANDHINAGAR': 'గాంధీ నగర్',
  'ASHOK NAGAR': 'అశోక్ నగర్',
  'ASHOKNAGAR': 'అశోక్ నగర్',
  'INDIRA NAGAR': 'ఇందిరా నగర్',
  'INDIRANAGAR': 'ఇందిరా నగర్',
  'RAM NAGAR': 'రామ్ నగర్',
  'RAMNAGAR': 'రామ్ నగర్',
  'NEHRU NAGAR': 'నెహ్రూ నగర్',
  'NEHRUNAGAR': 'నెహ్రూ నగర్',
  'VEMULAWADA': 'వేములవాడ',
  'KARIMNAGAR': 'కరీంనగర్',
  'HYDERABAD': 'హైదరాబాద్',
  'WARANGAL': 'వరంగల్',
  'HANAMKONDA': 'హనుమకొండ',
  'NIZAMABAD': 'నిజామాబాద్',
  'MEDAK': 'మెదక్',
  'SIDDIPET': 'సిద్ధిపేట',
  'PEDDAPALLI': 'పెద్దపల్లి',
  'JAGTIAL': 'జగిత్యాల',
  'MANCHERIAL': 'మంచిర్యాల',
  'KHAMMAM': 'ఖమ్మం',
  'KOTHAGUDEM': 'కొత్తగూడెం',
  'NALGONDA': 'నల్గొండ',
  'SURYAPET': 'సూర్యాపేట',
  'MAHABUBNAGAR': 'మహబూబ్‌నగర్',
  'WANAPARTHY': 'వనపర్తి',
  'GADWAL': 'గద్వాల',
  'NAGARKURNOOL': 'నాగర్‌కర్నూల్',
  'ADILABAD': 'ఆదిలాబాద్',
  'NIRMAL': 'నిర్మల్',
  'ASIFABAD': 'ఆసిఫాబాద్',
  'SANGAREDDY': 'సంగారెడ్డి',
  'MEDCHAL': 'మేడ్చల్',
  'MALKAJGIRI': 'మల్కాజ్‌గిరి',
  'RANGAREDDY': 'రంగారెడ్డి',
  'VIKARABAD': 'వికారాబాద్',
  'JANGAON': 'జనగామ',
  'BHOOPALPALLY': 'భూపాలపల్లి',
  'MULUGU': 'ములుగు',
  'MAHABUBABAD': 'మహబూబాబాద్',

  // Common boundary & property terms
  'HOUSE OF OTHERS': 'ఇతరుల ఇల్లు',
  'OTHERS HOUSE': 'ఇతరుల ఇల్లు',
  'OPEN PLACE OF OTHERS': 'ఇతరుల ఖాళీ స్థలము',
  'OTHERS OPEN PLACE': 'ఇతరుల ఖాళీ స్థలము',
  'OPEN PLOT OF OTHERS': 'ఇతరుల ఓపెన్ ప్లాట్',
  'OTHERS PLOT': 'ఇతరుల ప్లాట్',
  'PLOT OF OTHERS': 'ఇతరుల ప్లాట్',
  'LAND OF OTHERS': 'ఇతరుల భూమి',
  'AGRICULTURAL LAND OF OTHERS': 'ఇతరుల వ్యవసాయ భూమి',
  'NEIGHBOUR': 'పొరుగువారు',
  'NEIGHBOURS': 'పొరుగువారు',
  'NEIGHBOURS HOUSE': 'పొరుగువారి ఇల్లు',
  'OTHERS': 'ఇతరులు',
  'GOVERNMENT LAND': 'ప్రభుత్వ భూమి',
  'GOVT LAND': 'ప్రభుత్వ భూమి',
  'GOVERNMENT': 'ప్రభుత్వ',
  'GRAMA KANTAM': 'గ్రామ కంఠం',
  'GRAMAKANTAM': 'గ్రామ కంఠం',
  'DRAINAGE': 'మురుగు కాలువ',
  'NALA': 'నాల / కాలువ',
  'CANAL': 'కాలువ',
  'COMPOUND WALL': 'రక్షణ గోడ',
  'BOUNDARIES': 'హద్దులు',
  'BOUNDARY': 'హద్దు',

  // Open Plot Location Templates
  'NEAR/ADJACENT H.NO.': 'సమీపమున/ఆనుకొని ఉన్న ఇంటి నం.',
  'NEAR H.NO.': 'సమీప ఇంటి నం.',
  'ADJACENT H.NO.': 'ఆనుకొని ఉన్న ఇంటి నం.',
  'OPP. H.NO.': 'ఎదురుగా ఉన్న ఇంటి నం.',
  'OPP H.NO.': 'ఎదురుగా ఉన్న ఇంటి నం.',
  'BESIDE H.NO.': 'పక్కన ఉన్న ఇంటి నం.',
  'NEAR': 'సమీప',
  'ADJACENT': 'ఆనుకొని ఉన్న',
  'OPP': 'ఎదురుగా ఉన్న',
  'OPP.': 'ఎదురుగా ఉన్న',
  'BESIDE': 'పక్కన ఉన్న',

  // Roads
  'WIDE ROAD': 'వెడల్పు రోడ్డు',
  'CC ROAD': 'సి.సి. రోడ్డు',
  'BT ROAD': 'బి.టి. రోడ్డు',
  'TAR ROAD': 'తారు రోడ్డు',
  'MUD ROAD': 'మట్టి రోడ్డు',
  'PASSAGE': 'దారి',
  'LANE': 'సందు',
  'STREET': 'వీధి',
  'WAY': 'దారి',
  'CUL-DE-SAC': 'చివరి మలుపు',
  'DEAD END': 'ముగింపు రోడ్డు',
  'DEAD-END': 'ముగింపు రోడ్డు',
  'THROUGH ROAD': 'త్రూ రోడ్డు',
  'T-JUNCTION': 'టి-జంక్షన్',

  // Directions
  'NORTH': 'ఉత్తరం',
  'SOUTH': 'దక్షిణం',
  'EAST': 'తూర్పు',
  'WEST': 'పడమర',

  // Legal roles & entities
  'MUNICIPAL COUNCIL': 'మున్సిపల్ కౌన్సిల్',
  'MUNICIPAL CORPORATION': 'మున్సిపల్ కార్పొరేషన్',
  'GRAM PANCHAYAT': 'గ్రామ పంచాయతీ',
  'MUNICIPALITY': 'మున్సిపాలిటీ',
  'COMMERCIAL': 'వాణిజ్య',
  'RESIDENTIAL': 'నివాస',

  // Common Names & Surnames
  'RAMA RAO': 'రామారావు',
  'RAMARAO': 'రామారావు',
  'NARSINGA RAO': 'నర్సింగరావు',
  'NARSINGARAO': 'నర్సింగరావు',
  'NARSING RAO': 'నర్సింగ్ రావు',
  'NARSING': 'నర్సింగ్',
  'SRINIVAS': 'శ్రీనివాస్',
  'SRINIVASA RAO': 'శ్రీనివాసరావు',
  'VENKATESHAM': 'వెంకటేశం',
  'VENKATESH': 'వెంకటేష్',
  'VENKATESWARLU': 'వెంకటేశ్వర్లు',
  'VENKATESHWARLU': 'వెంకటేశ్వర్లు',
  'RAMULU': 'రాములు',
  'LAXMAN': 'లక్ష్మణ్',
  'LAKSHMAN': 'లక్ష్మణ్',
  'KRISHNA': 'కృష్ణ',
  'MOHAN': 'మోహన్',
  'MOHAN RAO': 'మోహన్ రావు',
  'SUDHAKAR': 'సుధాకర్',
  'RAVI': 'రవి',
  'RAJU': 'రాజు',
  'KUMAR': 'కుమార్',
  'REDDY': 'రెడ్డి',
  'RAO': 'రావు',
  'GOUD': 'గౌడ్',
  'SHARMA': 'శర్మ',
  'GUPTA': 'గుప్తా',
  'CHARY': 'చారి',
  'SHEKAR': 'శేఖర్',
  'PRASAD': 'ప్రసాద్',
  'SURESH': 'సురేష్',
  'RAMESH': 'రమేష్',
  'MAHESH': 'మహేష్',
  'NARESH': 'నరేష్',
  'RAJESH': 'రాజేష్',
  'ANIL': 'అనిల్',
  'SUNIL': 'సునీల్',
  'PRAVEEN': 'ప్రవీణ్',
  'MALLAIAH': 'మల్లయ్య',
  'KOMURAIAH': 'కొమురయ్య',
  'POCHAIAH': 'పోచయ్య',
  'RAJAIAH': 'రాజయ్య',
  'CHANDRAIAH': 'చంద్రయ్య',
  'ANJAIAH': 'అంజయ్య',
  'KANAKAIAH': 'కనకయ్య',
  'LINGAIAH': 'లింగయ్య',
  'BHASKAR': 'భాస్కర్',
  'SHANKAR': 'శంకర్',
  'THIRUPATHI': 'తిరుపతి',
  'TIRUPATHI': 'తిరుపతి',
  'BALARAJU': 'బాలరాజు',
  'SRIDHAR': 'శ్రీధర్',
  'SANJEEV': 'సంజీవ్',
  'RAVINDER': 'రవీందర్',
  'MAHENDER': 'మహేందర్',
  'SAMPATH': 'సంపత్',
  'SWAMY': 'స్వామి',
  'DEVENDER': 'దేవేందర్',
  'CHANDRAMOULI': 'చంద్రమౌళి',
  'SATYANARAYANA': 'సత్యనారాయణ',
  'LAXMINARAYANA': 'లక్ష్మీనారాయణ',
  'NAVANEETHA': 'నవనీత',
  'LAKSHMI': 'లక్ష్మి',
  'LAXMI': 'లక్ష్మి',
  'SARASWATHI': 'సరస్వతి',
  'PADMA': 'పద్మ',
  'SUJATHA': 'సుజాత',
  'LATHA': 'లత',
  'KAVITHA': 'కవిత',
  'SUNITHA': 'సునీత',
  'RADHA': 'రాధ',
  'SWATHI': 'స్వాతి',
  'RENUKA': 'రేణుక',
  'LAVANYA': 'లావణ్య',
  'MADHAVI': 'మాధవి',
  'SUMATHI': 'సుమతి',
  'ANITHA': 'అనిత',
  'SHOBHA': 'శోభ',
  'SARITHA': 'సరిత',
  'MANJULA': 'మంజుల',
  'VIJAYA': 'విజయ',
  'USHA': 'ఉష',
  'GEETHA': 'గీత',
  'PUSHPA': 'పుష్ప',
  'KALYANI': 'కళ్యాణి',
};

const SINGLE_LETTER_MAP: Record<string, string> = {
  'A': 'ఎ.', 'B': 'బి.', 'C': 'సి.', 'D': 'డి.', 'E': 'ఇ.', 'F': 'ఎఫ్.',
  'G': 'జి.', 'H': 'హెచ్.', 'I': 'ఐ.', 'J': 'జె.', 'K': 'కె.', 'L': 'ఎల్.',
  'M': 'ఎం.', 'N': 'ఎన్.', 'O': 'ఓ.', 'P': 'పి.', 'Q': 'క్యూ.', 'R': 'ఆర్.',
  'S': 'ఎస్.', 'T': 'టి.', 'U': 'యు.', 'V': 'వి.', 'W': 'డబ్ల్యూ.', 'X': 'ఎక్స్.',
  'Y': 'వై.', 'Z': 'జెడ్.'
};

const VOWELS: Record<string, string> = {
  'a': 'అ', 'aa': 'ఆ', 'i': 'ఇ', 'ee': 'ఈ', 'u': 'ఉ', 'oo': 'ఊ',
  'e': 'ఎ', 'ea': 'ఈ', 'ai': 'ై', 'o': 'ఒ', 'ou': 'ఔ', 'au': 'ఔ'
};

const CONSONANTS: Record<string, string> = {
  'k': 'క', 'kh': 'ఖ', 'g': 'గ', 'gh': 'ఘ',
  'ch': 'చ', 'chh': 'ఛ', 'j': 'జ', 'jh': 'ఝ',
  't': 'ట', 'th': 'థ', 'd': 'డ', 'dh': 'ధ',
  'n': 'న', 'p': 'ప', 'ph': 'ఫ', 'f': 'ఫ', 'b': 'బ', 'bh': 'భ', 'm': 'మ',
  'y': 'య', 'r': 'ర', 'l': 'ల', 'v': 'వ', 'w': 'వ',
  'sh': 'శ', 's': 'స', 'h': 'హ'
};

/**
 * Phonetic English to Telugu transliterator for unknown names/words
 */
export function transliterateEnglishToTelugu(word: string): string {
  if (!word) return '';
  const clean = word.trim();
  if (!clean) return '';

  // Check dictionary first (case-insensitive)
  const upper = clean.toUpperCase();
  if (VOCABULARY_MAP[upper]) {
    return VOCABULARY_MAP[upper];
  }

  // Handle single letters like "V." or "V"
  if (/^[A-Z]\.?$/i.test(clean)) {
    const letter = clean[0].toUpperCase();
    return SINGLE_LETTER_MAP[letter] || clean;
  }

  // If word contains numbers or symbols only, return as is
  if (/^[0-9./_\-:,()]+$/.test(clean)) {
    return clean;
  }

  // Simple rule-based phonetic transliteration
  let str = clean.toLowerCase();
  let result = '';
  let i = 0;

  while (i < str.length) {
    const c3 = str.slice(i, i + 3);
    const c2 = str.slice(i, i + 2);
    const c1 = str.slice(i, i + 1);

    let cons = '';
    let consLen = 0;

    if (CONSONANTS[c3]) {
      cons = CONSONANTS[c3];
      consLen = 3;
    } else if (CONSONANTS[c2]) {
      cons = CONSONANTS[c2];
      consLen = 2;
    } else if (CONSONANTS[c1]) {
      cons = CONSONANTS[c1];
      consLen = 1;
    }

    if (cons) {
      i += consLen;
      const v2 = str.slice(i, i + 2);
      const v1 = str.slice(i, i + 1);

      if (v2 === 'aa') {
        result += cons + 'ా';
        i += 2;
      } else if (v2 === 'ee' || v2 === 'ea') {
        result += cons + 'ీ';
        i += 2;
      } else if (v2 === 'oo') {
        result += cons + 'ూ';
        i += 2;
      } else if (v2 === 'ai') {
        result += cons + 'ై';
        i += 2;
      } else if (v2 === 'ou' || v2 === 'au') {
        result += cons + 'ౌ';
        i += 2;
      } else if (v1 === 'a') {
        result += cons; // inherent 'a'
        i += 1;
      } else if (v1 === 'i') {
        result += cons + 'ి';
        i += 1;
      } else if (v1 === 'u') {
        result += cons + 'ు';
        i += 1;
      } else if (v1 === 'e') {
        result += cons + 'ె';
        i += 1;
      } else if (v1 === 'o') {
        result += cons + 'ొ';
        i += 1;
      } else {
        if (i < str.length && /[a-z]/i.test(str[i])) {
          result += cons + '్';
        } else {
          result += cons;
        }
      }
    } else {
      const v2 = str.slice(i, i + 2);
      const v1 = str.slice(i, i + 1);
      if (VOWELS[v2]) {
        result += VOWELS[v2];
        i += 2;
      } else if (VOWELS[v1]) {
        result += VOWELS[v1];
        i += 1;
      } else {
        result += str[i];
        i += 1;
      }
    }
  }

  return result || clean;
}

/**
 * Translates any English string (phrase, legal clause, name, boundary, address) into Telugu
 * with zero untranslated English text remaining.
 */
export function toTeluguText(text: string): string {
  if (!text) return '';
  let str = text;

  // 1. Structure & Building Types (R.C.C. -> ఆర్.సి.సి.)
  str = str.replace(/\bR\.?\s*C\.?\s*C\.?\s*BUILDING\b/gi, 'ఆర్.సి.సి. భవనము');
  str = str.replace(/\bR\.?\s*C\.?\s*C\.?\s*ROOF(?:\s*HOUSE)?\b/gi, 'ఆర్.సి.సి. భవనము');
  str = str.replace(/\bR\.?\s*C\.?\s*C\.?(?!\w)/gi, 'ఆర్.సి.సి.');
  str = str.replace(/\bA\.?\s*C\.?\s*SHEET(?:\s*HOUSE)?\b/gi, 'ఎ.సి. రేకుల ఇల్లు');
  str = str.replace(/\bA\.?\s*C\.?(?!\w)/gi, 'ఎ.సి.');
  str = str.replace(/\bTILED\s*HOUSE\b/gi, 'పెంకుటిల్లు');
  str = str.replace(/\bTIN\s*SHED\b/gi, 'రేకుల షెడ్డు');
  str = str.replace(/\bSHED\b/gi, 'షెడ్డు');
  str = str.replace(/\bBUILDING\b/gi, 'భవనము');
  str = str.replace(/\bWITH OPEN PLACE\b/gi, 'మరియు ఖాళీ స్థలము');
  str = str.replace(/\bOPEN PLACE\b/gi, 'ఖాళీ స్థలము');
  str = str.replace(/\bOPEN PLOT\b/gi, 'ఓపెన్ ప్లాట్');
  str = str.replace(/\bPLOT\b/gi, 'ప్లాట్');
  str = str.replace(/\bDEMOLISHED HOUSE\b/gi, 'కూల్చివేయబడిన ఇల్లు');
  str = str.replace(/\bDISMANTLED HOUSE\b/gi, 'కూల్చివేయబడిన ఇల్లు');
  str = str.replace(/\bPART OPEN PLACE\b/gi, 'భాగస్వామ్యపు ఖాళీ స్థలము');

  // 2. House Bearing, Plot Location Templates & Authority Clauses
  // (MUST be processed BEFORE single-word "H.NO.", "HOUSE", "NEAR", "ADJACENT", etc.)
  str = str.replace(/\bNEAR\s*\/\s*ADJACENT\s*(?:H\.?NO\.?|HOUSE\s*(?:NO\.?|NUMBER)?)?\s*[:.-]?\s*/gi, 'సమీపమున/ఆనుకొని ఉన్న ఇంటి నం. ');
  str = str.replace(/\bNEAR\s+(?:H\.?NO\.?|HOUSE\s*(?:NO\.?|NUMBER)?)\s*[:.-]?\s*/gi, 'సమీప ఇంటి నం. ');
  str = str.replace(/\bADJACENT\s+(?:H\.?NO\.?|HOUSE\s*(?:NO\.?|NUMBER)?)\s*[:.-]?\s*/gi, 'ఆనుకొని ఉన్న ఇంటి నం. ');
  str = str.replace(/\bOPP\.?\s*(?:H\.?NO\.?|HOUSE\s*(?:NO\.?|NUMBER)?)\s*[:.-]?\s*/gi, 'ఎదురుగా ఉన్న ఇంటి నం. ');
  str = str.replace(/\bBESIDE\s+(?:H\.?NO\.?|HOUSE\s*(?:NO\.?|NUMBER)?)\s*[:.-]?\s*/gi, 'పక్కన ఉన్న ఇంటి నం. ');

  str = str.replace(/\bBEARING\s+MUNICIPAL\s+CORPORATION\s+HOUSE\s+(?:NO\.?|NUMBER)\s*/gi, 'మున్సిపల్ కార్పొరేషన్ ఇంటి నెం. ');
  str = str.replace(/\bBEARING\s+MUNICIPAL\s+COUNCIL\s+HOUSE\s+(?:NO\.?|NUMBER)\s*/gi, 'మున్సిపల్ కౌన్సిల్ ఇంటి నెం. ');
  str = str.replace(/\bBEARING\s+GRAM\s+PANCHAYAT\s+HOUSE\s+(?:NO\.?|NUMBER)\s*/gi, 'గ్రామ పంచాయతీ ఇంటి నెం. ');
  str = str.replace(/\bBEARING\s+HOUSE\s+(?:NO\.?|NUMBER)\s*/gi, 'ఇంటి నెం. ');
  str = str.replace(/\bBEARING\s+H\.NO\.?\s*/gi, 'ఇంటి నెం. ');
  str = str.replace(/\bMUNICIPAL\s+CORPORATION\s+HOUSE\s+(?:NO\.?|NUMBER)\s*/gi, 'మున్సిపల్ కార్పొరేషన్ ఇంటి నెం. ');
  str = str.replace(/\bMUNICIPAL\s+COUNCIL\s+HOUSE\s+(?:NO\.?|NUMBER)\s*/gi, 'మున్సిపల్ కౌన్సిల్ ఇంటి నెం. ');
  str = str.replace(/\bGRAM\s+PANCHAYAT\s+HOUSE\s+(?:NO\.?|NUMBER)\s*/gi, 'గ్రామ పంచాయతీ ఇంటి నెం. ');
  str = str.replace(/\bHOUSE\s+(?:NO\.?|NUMBER)\s*/gi, 'ఇంటి నెం. ');
  str = str.replace(/\bH\.NO\.?\s*/gi, 'ఇంటి నెం. ');
  str = str.replace(/\bBEARING\b/gi, 'కలిగియున్న');

  // Catch remaining isolated location keywords if H.NO. was already replaced earlier or stripped
  str = str.replace(/\bNEAR\b/gi, 'సమీప');
  str = str.replace(/\bADJACENT\b/gi, 'ఆనుకొని ఉన్న');
  str = str.replace(/\bOPP\.?\b/gi, 'ఎదురుగా ఉన్న');
  str = str.replace(/\bBESIDE\b/gi, 'పక్కన ఉన్న');

  // 3. Multi-word dictionary matches (sorted longest first)
  const phrases = Object.keys(VOCABULARY_MAP).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    str = str.replace(regex, VOCABULARY_MAP[phrase]);
  }

  // 4. Standard Deed Legal Clauses
  str = str.replace(/\bALL THAT THE\b/gi, 'అన్నియు');
  str = str.replace(/\bADMEASURING A TOTAL AREA OF\b/gi, 'కలిగియున్న మొత్తం విస్తీర్ణం');
  str = str.replace(/\bEQUIVALENT TO\b/gi, 'అనగా');
  str = str.replace(/\bHAVING PLINTH AREA OF\b/gi, 'కలిగియున్న ప్లింత్ ఏరియా');
  str = str.replace(/\bTOTAL PLINTH AREA\b/gi, 'మొత్తం ప్లింత్ ఏరియా');
  str = str.replace(/\bPLINTH AREA\b/gi, 'ప్లింత్ ఏరియా');
  str = str.replace(/\bSQUARE YARDS\b/gi, 'చదరపు గజాలు');
  str = str.replace(/\bSQ\.?\s*YARDS?\b/gi, 'చదరపు గజాలు');
  str = str.replace(/\bSQUARE METERS\b/gi, 'చదరపు మీటర్లు');
  str = str.replace(/\bSQUARE METRES\b/gi, 'చదరపు మీటర్లు');
  str = str.replace(/\bSQ\.?\s*MTRS?\b/gi, 'చదరపు మీటర్లు');
  str = str.replace(/\bSQUARE FEETS?\b/gi, 'చదరపు అడుగులు');
  str = str.replace(/\bSQ\.?\s*FT\.?\b/gi, 'చదరపు అడుగులు');
  str = str.replace(/\bIN PLOT NO\.?\s*/gi, 'ప్లాట్ నెం.');
  str = str.replace(/\bPLOT NO\.?\s*/gi, 'ప్లాట్ నెం.');
  str = str.replace(/\bAND SURVEY NO\.?\s*/gi, 'మరియు సర్వే నెం.');
  str = str.replace(/\bIN SURVEY NO\.?\s*/gi, 'సర్వే నెం.');
  str = str.replace(/\bSURVEY NO\.?\s*/gi, 'సర్వే నెం.');
  str = str.replace(/\bSY\.?\s*NO\.?\s*/gi, 'సర్వే నెం.');
  str = str.replace(/\bSITUATED AT\b/gi, 'నందు కలదు,');
  str = str.replace(/\bLOCALITY OF\b/gi, 'ప్రాంతము,');
  str = str.replace(/\bLOCALITY\b/gi, 'ప్రాంతము');
  str = str.replace(/\bDISTRICT:\s*/gi, 'జిల్లా: ');
  str = str.replace(/\bDISTRICT\b/gi, 'జిల్లా');
  str = str.replace(/\bMANDAL\b/gi, 'మండలము');
  str = str.replace(/\bVILLAGE\b/gi, 'గ్రామము');
  str = str.replace(/\bTOGETHER WITH THE\b/gi, 'మరియు');
  str = str.replace(/\bTOGETHER WITH\b/gi, 'మరియు');
  str = str.replace(/\bOF THE\b/gi, 'యొక్క');
  str = str.replace(/\bOF\b/gi, 'యొక్క');
  str = str.replace(/\bAND\b/gi, 'మరియు');
  str = str.replace(/\(PART\)/gi, '(భాగము)');
  str = str.replace(/\bPART\b/gi, 'భాగము');
  str = str.replace(/\bHOUSE OF\s+/gi, '');
  str = str.replace(/\bPLOT OF\s+/gi, '');
  str = str.replace(/\bLAND OF\s+/gi, '');
  str = str.replace(/\bHOUSE\b/gi, 'ఇల్లు');
  str = str.replace(/\bNO\.?\s*(?=\d)/gi, 'నెం. ');

  // 5. Party relations, headings, signatures, ages, occupations, addresses
  str = str.replace(/\bEXECUTANT\/S\s+SIGN\/S\b/gi, 'నిర్వహణకర్తల సంతకాలు');
  str = str.replace(/\bCLAIMANT\/S\s+SIGN\/S\b/gi, 'హక్కుదారుల సంతకాలు');
  str = str.replace(/నిర్వహణకర్తల\s+సంతకం\s*\/\s*సంతకాలు/gi, 'నిర్వహణకర్తల సంతకాలు');
  str = str.replace(/హక్కుదారుల\s+సంతకం\s*\/\s*సంతకాలు/gi, 'హక్కుదారుల సంతకాలు');
  str = str.replace(/\bEXECUTANT\/S:?\s*/gi, 'నిర్వహణకర్తలు: ');
  str = str.replace(/\bCLAIMANT\/S:?\s*/gi, 'హక్కుదారులు: ');
  str = str.replace(/\bCLAIMANTS?:?\s*/gi, 'హక్కుదారులు: ');
  str = str.replace(/హక్కుదారులు\s*\/\s*క్లెయిమంట్లు:?/gi, 'హక్కుదారులు:');
  str = str.replace(/క్లెయిమంట్లు:?/gi, 'హక్కుదారులు:');
  str = str.replace(/క్లెయిమంట్/gi, 'హక్కుదారు');
  str = str.replace(/\bS\/O\b/gi, 'తండ్రి పేరు:');
  str = str.replace(/\bW\/O\b/gi, 'భర్త పేరు:');
  str = str.replace(/\bD\/O\b/gi, 'తండ్రి పేరు:');
  str = str.replace(/\bC\/O\b/gi, 'సంరక్షకుడు:');
  str = str.replace(/\bREP\.?\s*BY\b/gi, 'ప్రతినిధి:');
  str = str.replace(/\bAGED\s*([0-9]+)\s*YEARS\b/gi, 'వయస్సు: $1 సంవత్సరాలు');
  str = str.replace(/\bAGED\b/gi, 'వయస్సు:');
  str = str.replace(/\bYEARS\b/gi, 'సంవత్సరాలు');
  str = str.replace(/\bOCCU:\s*/gi, 'వృత్తి: ');
  str = str.replace(/\bOCCU\b/gi, 'వృత్తి');
  str = str.replace(/\bOCCUPATION:\s*/gi, 'వృత్తి: ');
  str = str.replace(/\bBUSINESS\b/gi, 'వ్యాపారము');
  str = str.replace(/\bEMPLOYEE\b/gi, 'ఉద్యోగి');
  str = str.replace(/\bAGRICULTURE\b/gi, 'వ్యవసాయము');
  str = str.replace(/\bHOUSEWIFE\b/gi, 'గృహిణి');
  str = str.replace(/\bSTUDENT\b/gi, 'విద్యార్థి');
  str = str.replace(/\bPRIVATE EMPLOYEE\b/gi, 'ప్రైవేట్ ఉద్యోగి');
  str = str.replace(/\bGOVT\.?\s*EMPLOYEE\b/gi, 'ప్రభుత్వ ఉద్యోగి');
  str = str.replace(/\bADVOCATE\b/gi, 'న్యాయవాది');
  str = str.replace(/\bDOCTOR\b/gi, 'వైద్యుడు');
  str = str.replace(/\bENGINEER\b/gi, 'ఇంజనీర్');
  str = str.replace(/\bTEACHER\b/gi, 'ఉపాధ్యాయుడు');
  str = str.replace(/\bCONTRACTOR\b/gi, 'కాంట్రాక్టర్');
  str = str.replace(/\bDRIVER\b/gi, 'డ్రైవర్');
  str = str.replace(/\bLABOUR\b/gi, 'కూలి');
  str = str.replace(/\bR\/O\s*/gi, 'నివాసం: ');

  // 6. Handle single letter initials with trailing dot: e.g. "V.", "B.", "K."
  // Replace BEFORE pure letter matching so "V." becomes "వి." instead of "వి.."
  str = str.replace(/\b([A-Za-z])\./g, (_, letter) => {
    return SINGLE_LETTER_MAP[letter.toUpperCase()] || letter;
  });

  // 7. For any remaining isolated English words/names (e.g. person names, colonies), transliterate them
  str = str.replace(/[a-zA-Z]+/g, (match) => {
    return transliterateEnglishToTelugu(match);
  });

  // Clean up any double periods or trailing punctuation artifacts
  str = str.replace(/\.{2,}/g, '.');
  str = str.replace(/\s{2,}/g, ' ');

  return str;
}

/**
 * Translates boundary strings specifically for sketch rendering
 * e.g., "HOUSE OF OTHERS" -> "ఇతరుల ఇల్లు"
 * "HOUSE OF V. RAMA RAO" -> "వి. రామారావు ఇల్లు"
 * "33'-0" WIDE ROAD" -> "33'-0" వెడల్పు రోడ్డు"
 * "PLOT NO. 19" -> "ప్లాట్ నెం. 19"
 */
export function translateBoundaryForSketch(boundaryText: string): string {
  if (!boundaryText) return '';
  const clean = boundaryText.trim();
  if (!clean) return '';

  const upper = clean.toUpperCase();

  // 1. Direct dictionary matches
  if (VOCABULARY_MAP[upper]) {
    return VOCABULARY_MAP[upper];
  }

  // 2. Pattern: HOUSE OF <NAME> -> <NAME> ఇల్లు
  const houseOfMatch = upper.match(/^HOUSE\s+OF\s+(.+)$/i);
  if (houseOfMatch) {
    const personName = houseOfMatch[1].trim();
    if (personName.toUpperCase() === 'OTHERS') {
      return 'ఇతరుల ఇల్లు';
    }
    const teluguName = toTeluguText(personName);
    return `${teluguName} ఇల్లు`;
  }

  // 3. Pattern: PLOT NO. <NUMBER> -> ప్లాట్ నెం. <NUMBER>
  const plotNoMatch = upper.match(/^(?:OPEN\s+)?PLOT\s+(?:NO\.?|NUMBER)\s*([0-9A-Z/_-]+)$/i);
  if (plotNoMatch) {
    return `ప్లాట్ నెం. ${plotNoMatch[1]}`;
  }

  // 4. Pattern: PLOT OF <NAME> -> <NAME> ప్లాట్
  const plotOfMatch = upper.match(/^(?:OPEN\s+)?PLOT\s+OF\s+(.+)$/i);
  if (plotOfMatch) {
    const detail = plotOfMatch[1].trim();
    if (detail.toUpperCase() === 'OTHERS') {
      return 'ఇతరుల ప్లాట్';
    }
    const teluguDetail = toTeluguText(detail);
    return `${teluguDetail} ప్లాట్`;
  }

  // 5. Pattern: SURVEY NO. / SY NO. <NUMBER> -> సర్వే నెం. <NUMBER>
  const surveyMatch = upper.match(/^(?:SURVEY|SY)\s*(?:NO\.?|NUMBER)\s*([0-9A-Z/_-]+)$/i);
  if (surveyMatch) {
    return `సర్వే నెం. ${surveyMatch[1]}`;
  }

  // 6. Pattern: <WIDTH> WIDE ROAD / ROAD
  const roadMatch = upper.match(/^(.+?)\s*(?:WIDE\s+)?ROAD$/i);
  if (roadMatch) {
    const prefix = roadMatch[1].trim();
    if (prefix) {
      return `${prefix} వెడల్పు రోడ్డు`;
    }
    return 'రోడ్డు';
  }

  if (upper === 'ROAD') {
    return 'రోడ్డు';
  }

  // Default to full translation pipeline
  return toTeluguText(clean);
}
