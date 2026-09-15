// Reference tables — the registration domain the app knows about. These are not
// sample data: they are the deed types, drafts, categories and duty rules the
// engine works from. Everything a user types lives in AppState.form (see fields.ts).

export const STEPS = [
    { id: 0, label: 'Draft, Deed & Category', sub: 'Instrument, category & draft form', phase: 1 },
    { id: 1, label: 'Link Deed & Enclosures', sub: 'Prior document & enclosures', phase: 1 },
    { id: 2, label: 'Jurisdiction', sub: 'State, district & SRO', phase: 2 },
    { id: 3, label: 'Property Schedules', sub: 'Identification, extent, boundaries & scheduled description', phase: 2 },
    { id: 4, label: 'Market Value', sub: 'Per say vs consideration', phase: 2 },
    { id: 5, label: 'Payment Details', sub: 'Instrument recited in the receipt', phase: 2 },
    { id: 6, label: 'Executant Details', sub: 'Seller / donor / first party', phase: 3 },
    { id: 7, label: 'Claimant Details', sub: 'Buyer / donee / second party', phase: 3 },
    { id: 8, label: 'Reverify', sub: 'Readiness checks & review', phase: 4 },
    { id: 9, label: 'Generate Deed', sub: 'Fill the template & download', phase: 4 },
    { id: 10, label: 'Plan Sketch (Beta)', sub: 'Type four boundary dimensions — experimental proportional site sketch', phase: 4 }
  ];

export const DEEDS = [
    { type: 'Sale', label: 'Sale Deed', telugu: 'క్రయ విక్రయ దస్తావేజు', badge: 'Most common', book: 'Book-1', desc: 'Absolute transfer of ownership for monetary consideration with vacant possession.' },
    { type: 'Mortgage', label: 'Mortgage', telugu: 'తాకట్టు / కుదువ పత్రం', badge: 'Bank / loan', book: 'Book-1', desc: 'Securing payment of money against immovable property, with or without possession.' },
    { type: 'Gift', label: 'Gift Deed', telugu: 'దాన పత్రం', badge: 'Family concession', book: 'Book-1', desc: 'Voluntary transfer without consideration. Concessional duty for immediate family.' },
    { type: 'Partition', label: 'Partition', telugu: 'భాగ పరిష్కార పత్రం', badge: 'Joint division', book: 'Book-1', desc: 'Dividing jointly held ancestral or co-parcenary property into distinct shares.' },
    { type: 'Release', label: 'Release Deed', telugu: 'హక్కు విడుదల పత్రం', badge: 'Relinquish', book: 'Book-1', desc: 'Relinquishing an undivided share in favour of existing co-owners or co-heirs.' },
    { type: 'Exchange', label: 'Exchange Deed', telugu: 'మారకపు దస్తావేజు', badge: 'Mutual transfer', book: 'Book-1', desc: 'Mutual transfer of one immovable property in exchange for another.' },
    { type: 'Lease', label: 'Lease Deed', telugu: 'కౌలు / లీజు పత్రం', badge: 'Tenancy', book: 'Book-1', desc: 'Right to enjoy property for a defined term against rent or premium.' },
    { type: 'GPA/Power of Attorney', label: 'GPA / Power of Attorney', telugu: 'జనరల్ పవర్ ఆఫ్ అటార్నీ', badge: 'Developer / agent', book: 'Book-1', desc: 'Appointing an agent or developer with development or conveyance powers.' },
    { type: 'Rectification', label: 'Rectification Deed', telugu: 'సవరణ దస్తావేజు', badge: 'Article 48', book: 'Book-1', desc: 'Correcting survey numbers, boundaries or extents in a prior registered deed.' },
    { type: 'Cancellation', label: 'Cancellation Deed', telugu: 'రద్దు దస్తావేజు', badge: 'Revocation', book: 'Book-1', desc: 'Cancelling a prior registered agreement of sale, settlement or conveyance.' },
    { type: 'Will', label: 'Will / Testament', telugu: 'విల్లు దస్తావేజు', badge: 'Testament', book: 'Book-3', desc: 'Declaration of a testator’s intention with respect to property after demise.' },
    { type: 'Trust', label: 'Trust Deed', telugu: 'ట్రస్ట్ దస్తావేజు', badge: 'Charity / trust', book: 'Book-1', desc: 'Creating a public charitable, religious or private family trust.' }
  ];

export const DRAFTS = {
    Sale: [
      { id: 'Outright Absolute Sale Deed', title: 'Outright Absolute Sale Deed', telugu: 'పూర్తి సంపూర్ణ విక్రయ దస్తావేజు' },
      { id: 'Sale Deed by GPA Holder', title: 'Sale Deed by GPA Holder', telugu: 'GPA హోల్డర్ ద్వారా అమ్మకం దస్తావేజు' },
      { id: 'Tripartite Sale Deed', title: 'Tripartite Sale Deed (Landowner + Builder + Buyer)', telugu: 'త్రిపక్ష విక్రయ దస్తావేజు' },
      { id: 'Staged Consideration', title: 'Sale Deed with Advance & Staged Consideration', telugu: 'వాయిదాల ఒప్పందంతో కూడిన అమ్మకం దస్తావేజు' },
      { id: 'AGPA', title: 'Agreement of Sale cum GPA with Possession', telugu: 'విక్రయ ఒప్పందం కమ్ GPA (స్వాధీనంతో)' },
      { id: 'Court Auction', title: 'Court Auction / Decree Sale Deed', telugu: 'కోర్టు తీర్పు / వేలం విక్రయ దస్తావేజు' }
    ],
    Gift: [
      { id: 'Family', title: 'Gift Deed to Family Member (concessional duty)', telugu: 'కుటుంబ సభ్యునికి దాన పత్రం' },
      { id: 'NonFamily', title: 'Gift Deed to Non-Family / Third Party', telugu: 'ఇతరులకు దాన పత్రం' },
      { id: 'Trust', title: 'Gift Settlement to Trust / Charity', telugu: 'ట్రస్ట్ / ధార్మిక సంస్థకు దాన పరిష్కార పత్రం' }
    ],
    Mortgage: [
      { id: 'Simple', title: 'Simple Mortgage without Possession', telugu: 'స్వాధీనం లేని సాధారణ తాకట్టు పత్రం' },
      { id: 'Usufruct', title: 'Usufructuary Mortgage with Possession', telugu: 'స్వాధీనంతో కూడిన భోగ్య పత్రం' },
      { id: 'MODT', title: 'Memorandum of Deposit of Title Deeds (MODT)', telugu: 'టైటిల్ డీడ్స్ డిపాజిట్ మెమోరాండం' }
    ],
    Lease: [
      { id: 'Res', title: 'Residential Tenancy Lease Deed', telugu: 'నివాస గృహ కౌలు దస్తావేజు' },
      { id: 'Comm', title: 'Commercial Long-Term Lease Deed', telugu: 'వాణిజ్య దీర్ఘకాలిక లీజు ఒప్పందం' },
      { id: 'Agri', title: 'Agricultural Cultivation Lease Deed', telugu: 'వ్యవసాయ సాగు కౌలు దస్తావేజు' }
    ]
  };

export const CATEGORIES = [
    { key: 'Vacant Plot', label: 'Vacant Plot', telugu: 'ఖాళీ స్థలము / ఓపెన్ ప్లాట్', badge: 'Site / land' },
    { key: 'Residential', label: 'Residential House', telugu: 'నివాస భవనము / ఇల్లు', badge: 'Structure + land' },
    { key: 'Flat', label: 'Flat / Apartment Unit', telugu: 'ఫ్లాట్ / అపార్ట్‌మెంట్ & UDS', badge: 'Apartment' },
    { key: 'Demolished', label: 'Demolished Structure', telugu: 'కూల్చివేసిన / శిథిలమైన ఇల్లు', badge: 'Site valuation' },
    { key: 'Commercial', label: 'Commercial Complex', telugu: 'వాణిజ్య సముదాయము', badge: 'Commercial' },
    { key: 'Agricultural land', label: 'Agricultural Farm Land', telugu: 'వ్యవసాయ భూమి', badge: 'Farm / land' },
    { key: 'Part open place', label: 'Part Open Place', telugu: 'భాగశః ఖాళీ స్థలము', badge: 'Compound' }
  ];

export const RULES = {
    version: '2026.09.1',
    date: '2026-09-01',
    'Telangana (TS)': {
      def: { s: 5.5, t: 1.5, r: 0.5, u: 1000, m: 2500 },
      by: {
        Gift: { s: 1.0, t: 0.5, r: 0.5, u: 500, m: 2500 },
        Mortgage: { s: 0.5, t: 0, r: 0.5, u: 500, m: 2500 },
        Lease: { s: 2.0, t: 0, r: 0.5, u: 500, m: 2500 },
        Partition: { s: 1.0, t: 0.5, r: 0.5, u: 500, m: 2500 },
        Release: { s: 1.0, t: 0.5, r: 0.5, u: 500, m: 2500 },
        Rectification: { s: 0.5, t: 0, r: 0.5, u: 500, m: 0 },
        Cancellation: { s: 0.5, t: 0, r: 0.5, u: 500, m: 0 }
      }
    },
    'Andhra Pradesh (AP)': {
      def: { s: 5.5, t: 1.5, r: 0.5, u: 1000, m: 2500 },
      by: { Sale: { s: 5.0, t: 1.5, r: 1.0, u: 1000, m: 2500 } }
    }
  };
