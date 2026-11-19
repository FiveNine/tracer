/*
 * All the words on the Tracer site, in one place.
 * Structure: tracer-website/STRUCTURE.md (pages, sections, audiences). Edit copy here, then `npm run build`.
 *
 * Conventions in strings: **bold**, *italic* (headlines: the accent word), [label](href), {tbc} = a visible
 * "to be confirmed" marker for facts the team still has to supply. Page links use the page id ("token", "faq#token").
 * "@buy", "@explorer" … point at content.links.
 */
const TBC = '{tbc}';

export const site = {
  name: 'Tracer',
  lang: 'en',
  url: 'https://tracer.example',          // TBC: the production domain (used for canonical links and the sitemap)
  noindex: true,                          // flip to false at launch
  links: {
    buy: { label: 'Buy TRCR', href: 'https://quickswap.exchange/' },        // TBC: QuickSwap referral link (Luc)
    explorer: { label: 'Basescan', href: 'https://basescan.org' },
    base: { label: 'base.org', href: 'https://base.org' },
    carbonPioneers: { label: 'Carbon Pioneers', href: 'https://endglobalwarming.net' },   // TBC: final Carbon Pioneers URL
    docs: { label: 'Docs', href: 'https://docs.endglobalwarming.net' }
  },
  token: {
    name: 'Tracer', symbol: 'TRCR', network: 'Base', decimals: 18,
    address: '',                            // TBC: mainnet contract; empty = "published at launch" everywhere
    pending: 'Published at launch',
    supply: '12,500,000,000'                // TBC: confirm with the Tracer team
  },
  nav: [
    { label: 'Token', href: 'token' }, { label: 'Governance', href: 'governance' }, { label: 'Ecosystem', href: 'ecosystem' },
    { label: 'How to Base', href: 'base' }, { label: 'Roadmap', href: 'roadmap' }, { label: 'About', href: 'about' }
  ],
  footer: {
    tagline: 'The real in real-world asset. Carbon removal, traced on Base, governed by TRCR holders.',
    columns: [
      { title: 'Tracer', links: [{ label: 'Token', href: 'token' }, { label: 'Governance', href: 'governance' }, { label: 'Roadmap', href: 'roadmap' }, { label: 'About', href: 'about' }] },
      { title: 'Learn', links: [{ label: 'How to Base', href: 'base' }, { label: 'Ecosystem', href: 'ecosystem' }, { label: 'FAQ', href: 'faq' }, { label: 'Docs', href: '@docs' }] },
      { title: 'Elsewhere', links: [{ label: 'Carbon Pioneers', href: '@carbonPioneers' }, { label: 'Buy on QuickSwap', href: '@buy' }, { label: 'Base', href: '@base' }, { label: 'Basescan', href: '@explorer' }] },
      { title: 'Company', links: [{ label: 'Contact', href: 'contact' }, { label: 'Impressum', href: 'impressum' }, { label: 'Privacy', href: 'privacy' }, { label: 'Risk disclaimer', href: 'disclaimer' }] }
    ],
    small: '© 2026 Tracer',
    risk: 'Crypto assets are volatile and you can lose what you put in. Nothing on this site is financial advice. [Read the risk disclaimer](disclaimer).'
  },
  tracy: {
    name: 'Tracy', role: 'Tracer guide',
    greeting: 'Hi, I\'m Tracy. Ask me about TRCR, the airdrop, governance or Base.',
    suggestions: ['What is TRCR?', 'How do I buy TRCR?', 'How do I vote?', 'What is a Rabbit?'],
    placeholder: 'Ask about TRCR, Base, voting…',
    note: 'Preview: Tracy answers from this site\'s FAQ, in your browser. The full assistant is coming soon.',
    fallback: 'I don\'t have an answer for that yet. Try the [FAQ](faq), or [contact the team](contact).',
    embed: ''                               // TBC: Michiel's widget embed (script URL); when set it replaces the preview
  },
  forms: { sent: 'Thanks. This preview isn\'t connected to a mailbox yet, so nothing was sent. Email address {tbc}.' },

  faq: [
    { group: 'Token', q: 'What is TRCR?', a: ['TRCR is Tracer\'s governance token on Base. Holders use it to propose and vote on how the Carrot protocol runs.'], tags: ['token', 'trcr'] },
    { group: 'Token', q: 'What is the official contract address?', a: ['It is published on the [token page](token#contract) at launch, and nowhere else. Always check it before you buy.'], tags: ['contract', 'address', 'ca'] },
    { group: 'Token', q: 'Where can I buy TRCR?', a: ['On QuickSwap, on Base. Use the link on our [token page](token#buy) so you land on the official pair.'], tags: ['buy', 'quickswap', 'swap', 'purchase'] },
    { group: 'Token', q: 'What is the total supply?', a: ['12,500,000,000 TRCR ' + TBC + ', all minted once at genesis. There is no mint function, so supply can never go up; burns can only bring it down.'], tags: ['supply', 'tokenomics', 'mint', 'burn'] },
    { group: 'Token', q: 'Where are the tokens held?', a: ['In five Safes: Tracer Foundation, Team & advisors, Ecosystem, Treasury and Early backers. Their addresses are published on the [token page](token#distribution).'], tags: ['safe', 'safes', 'distribution', 'allocation', 'wallets'] },
    { group: 'Token', q: 'Is TRCR an investment?', a: ['TRCR gives you a vote in the Tracer DAO. It is not a share in a company and promises no return. Crypto assets are volatile; read the [risk disclaimer](disclaimer).'], tags: ['invest', 'price', 'profit'] },
    { group: 'Airdrop', q: 'Who gets the airdrop?', a: ['Eligibility will be published on the [token page](token#airdrop) before the drop ' + TBC + '.'], tags: ['airdrop', 'eligible', 'eligibility'] },
    { group: 'Airdrop', q: 'Do I need to claim the airdrop?', a: ['How tokens arrive will be published on the token page ' + TBC + '. We will never ask for your recovery phrase or send you to another site to claim.'], tags: ['claim', 'airdrop'] },
    { group: 'Airdrop', q: 'Someone sent me a DM about the airdrop. Is it real?', a: ['No. The team never sends the first message. Only trust the links on this site.'], tags: ['dm', 'scam', 'message'] },
    { group: 'Governance', q: 'How do I vote?', a: ['Hold TRCR and delegate your votes, to yourself or someone you trust. Votes only count after delegating. Then vote on live proposals.'], tags: ['vote', 'voting', 'dao'] },
    { group: 'Governance', q: 'Why do I have to delegate to myself?', a: ['TRCR counts voting power at the moment a proposal is made, and only for delegated tokens. Delegating to yourself is a one-time transaction.'], tags: ['delegate', 'delegation'] },
    { group: 'Governance', q: 'What can the DAO decide?', a: ['Which Endorsers may license carbon projects, which stablecoins are accepted, how the marketplace runs, pauses and contract upgrades.'], tags: ['dao', 'decide', 'proposal', 'governance'] },
    { group: 'Base', q: 'What is Base?', a: ['An Ethereum layer 2 incubated by Coinbase. It settles to Ethereum and keeps fees to cents.'], tags: ['base', 'layer', 'l2', 'network'] },
    { group: 'Base', q: 'Which wallet should I use?', a: ['Any EVM wallet that supports Base, such as Coinbase Wallet, MetaMask or Rabby. See [How to Base](base).'], tags: ['wallet', 'metamask', 'coinbase'] },
    { group: 'Base', q: 'What does a transaction cost?', a: ['Usually a few cents, paid in ETH on Base.'], tags: ['fee', 'fees', 'gas', 'cost'] },
    { group: 'Ecosystem', q: 'What is CRRT?', a: ['The Carrot protocol\'s carbon asset. One slice is one gram of endorsed carbon removal; a million slices is a tonne.'], tags: ['crrt', 'credit', 'carbon', 'slice'] },
    { group: 'Ecosystem', q: 'What is a Rabbit?', a: ['A retirement container. CRRT sent into a Rabbit is retired permanently, with its beneficiary and purpose on record. It can never be taken back out.'], tags: ['rabbit', 'retire', 'retirement', 'offset'] },
    { group: 'Ecosystem', q: 'Where can I buy carbon credits?', a: ['On the Carbon Pioneers marketplace, coming soon. The Carbon Impact Scan will guide you from your footprint to the right credits.'], tags: ['marketplace', 'buy', 'credits', 'scan'] }
  ],

  /* ------------------------------------------------------------------ home: the specimen */
  home: {
    title: 'Tracer: the real in real-world asset',
    description: 'Tracer governs the Carrot protocol: verified carbon removal, issued as CRRT on Base, traded in the open and retired for good. TRCR is how you take part.',
    hero: {
      specimen: 'SPECIMEN TRC-000 001',
      card: [['Measured', '1.000000 t CO₂', true], ['Slices', '1,000,000 × 1 g'], ['Endorsed', 'once, on Base'], ['Status', '**traceable**']],
      title: 'The *real* in real-world asset.',
      lede: ['Tracer governs the Carrot protocol: carbon removal that actually happened, issued on Base, traded in the open and retired for good. **TRCR** is how you take part.'],
      links: [{ label: 'Buy TRCR', href: '@buy' }, { label: 'Follow one tonne', href: '#endorse' }],
      cue: 'SCROLL · FOLLOW ONE TONNE'
    },
    chapters: [
      { id: 'lines', num: '00', eyebrow: 'Tracer in three lines', height: 150, title: 'Three things to *know*.',
        extra: { kind: 'lines', items: [
          { k: 'RWA', t: 'A real-world asset project', d: 'Every CRRT stands for carbon removal that actually happened, down to the gram.', href: 'ecosystem' },
          { k: 'Base', t: 'Built on Base', d: 'An Ethereum layer 2. One wallet, cents per transaction.', href: 'base' },
          { k: 'DAO', t: 'Run by its holders', d: 'TRCR holders propose and vote on how the protocol runs.', href: 'governance' }] } },
      { id: 'endorse', num: '01', eyebrow: 'Endorsed', height: 230, title: 'Checked once. *Engraved* for good.',
        body: ['Before a tonne exists on-chain, an **Endorser admitted by the DAO** checks the removal and endorses it.', 'Each credit ID can be endorsed once, for one project, forever. No double counting.'] },
      { id: 'slice', num: '02', eyebrow: 'Issued as CRRT', height: 240, title: 'Sliced to the *gram*.',
        body: ['One tonne is issued as **a million slices of CRRT**. Hold a gram or a thousand tonnes; every slice keeps its project and its history.'],
        extra: { kind: 'cutter', min: 1, max: 500, start: 120, hint: 'Drag the laser along the core, or use the slider.' } },
      { id: 'ledger', num: '03', eyebrow: 'On Base', height: 230, title: 'Stone in. *Ledger* out.',
        body: ['Every slice is a record on Base: who removed it, who endorsed it, who holds it now. **Anyone can check it. Nobody can edit it.**'],
        extra: { kind: 'record', rows: [['Asset', 'CRRT · ERC-1155'], ['Amount', '120,000 slices (120 kg)'], ['Project', 'Licence #014'], ['Endorsed by', 'Endorser E-07'], ['Protocol fee', '0'], ['Status', '**held**']], note: 'Example record. Live records appear after mainnet.' } },
      { id: 'retire', num: '04', eyebrow: 'Retired', height: 240, title: 'Retired. *Sealed.* Forever.',
        body: ['Send CRRT into a **Rabbit** and it is retired permanently, with the beneficiary and purpose on record.', 'It can never be withdrawn, sold or counted again.'] },
      { id: 'archive', num: '05', eyebrow: 'Governance', height: 220, title: 'Holders decide what goes *in*.',
        body: ['TRCR holders govern the protocol: which Endorsers are admitted, which stablecoins are accepted, how the market runs.'],
        extra: { kind: 'steps', items: [{ t: 'Hold', d: 'TRCR on Base is your voting weight.' }, { t: 'Delegate', d: 'Once, even to yourself.' }, { t: 'Vote', d: 'On Endorsers, payment tokens, upgrades.' }, { t: 'Execute', d: 'Passed proposals run through the Timelock.' }], link: { label: 'How governance works', href: 'governance' } } },
      { id: 'trcr', num: '06', eyebrow: 'The token', height: 170, title: 'TRCR, at a *glance*.',
        body: ['The airdrop and the QuickSwap launch are next. The token guide has the contract, how to buy and where every token sits.'],
        extra: { kind: 'cta', facts: [['Network', 'Base'], ['Supply', '12.5 billion ' + TBC], ['Minting', 'None after genesis'], ['Held in', 'Five Safes']],
          links: [{ label: 'Buy TRCR on QuickSwap', href: '@buy' }, { label: 'Read the token guide', href: 'token' }] } }
    ],
    callouts: [
      { id: 'scan', label: 'MEASURING THE TONNE', on: 'hero' },
      { id: 'face', label: 'ENDORSEMENT · ENGRAVED ONCE', on: 'endorse' },
      { id: 'cut', label: 'CUT · 120 KG', on: 'slice' },
      { id: 'ledger', label: 'THIS SLICE · 120,000 RECORDS', on: 'ledger' },
      { id: 'rabbit', label: 'RABBIT #0042 · SEALED', on: 'retire' },
      { id: 'archive', label: 'EVERY CORE IS A TONNE · BLUE = RETIRED', on: 'archive trcr', flip: true }
    ],
    // after the specimen: plain paper sections (no 3D)
    after: [
      { id: 'base', kind: 'split', eyebrow: 'Built on Base', title: 'Ethereum security, at cents a *move*.',
        lede: ['Base is an Ethereum layer 2 incubated by Coinbase. New to it? The guide takes you from no wallet to holding TRCR in six steps.'],
        links: [{ label: 'How to Base', href: 'base' }, { label: 'base.org', href: '@base' }] },
      { id: 'ecosystem', kind: 'cards', eyebrow: 'Ecosystem', title: 'Where to go *next*.',
        lede: ['The carbon side of the project lives on Carbon Pioneers.'],
        items: [
          { title: 'Marketplace', body: 'Buy CRRT from endorsed removal projects.', status: 'Coming soon', href: '@carbonPioneers' },
          { title: 'Carbon Impact Scan', body: 'A guided scan from your footprint to the right credits.', status: 'Coming soon', href: '@carbonPioneers' },
          { title: 'Academy', body: 'Courses for carbon buyers.', status: 'Later', href: '@carbonPioneers' },
          { title: 'News', body: 'Carbon removal news and market insight.', status: 'Live', href: '@carbonPioneers' }] },
      { id: 'roadmap', kind: 'timeline', eyebrow: 'Roadmap', title: 'Built, tested, and next *up*.', compact: true, link: { label: 'Full roadmap', href: 'roadmap' } },
      { id: 'faq', kind: 'faq', eyebrow: 'FAQ', title: 'Questions, *answered*.', limit: 5, askTracy: true, link: { label: 'All questions', href: 'faq' } }
    ]
  },

  roadmap: [
    { when: '2026', state: 'done', title: 'Carrot protocol built and tested', body: 'Contracts, governance and the indexer, tested on testnet.' },
    { when: 'Nov 2026', state: 'now', title: 'The new Tracer site', body: 'One place for the token, governance and the ecosystem.' },
    { when: TBC, state: 'next', title: 'TRCR airdrop on Base', body: 'Distribution from the five Safes.' },
    { when: TBC, state: 'next', title: 'TRCR on QuickSwap', body: 'Open trading on Base.' },
    { when: TBC, state: 'next', title: 'Carrot protocol on mainnet', body: 'Governance, issuance and retirement live on Base.' },
    { when: TBC, state: 'next', title: 'Marketplace on Carbon Pioneers', body: 'Buy CRRT from endorsed projects.' },
    { when: TBC, state: 'later', title: 'Carbon Impact Scan', body: 'A guided scan from footprint to removal.' },
    { when: TBC, state: 'later', title: 'Academy', body: 'Courses and certification for carbon buyers.' }
  ],

  /* ------------------------------------------------------------------ the other pages */
  pages: {
    token: {
      title: 'TRCR token: contract, airdrop, how to buy · Tracer',
      description: 'The official TRCR guide: contract address, how to buy on QuickSwap, the airdrop on Base and the five Safes that hold the supply.',
      head: { eyebrow: 'TRCR token', title: 'Everything about *TRCR*, in one place.', lede: ['The contract, how to buy, the airdrop and where every token sits. If someone sent you here with a question, the answer is on this page.'],
        chip: true, ctas: [{ label: 'Buy on QuickSwap', href: '@buy' }, { label: 'Airdrop', href: '#airdrop' }] },
      sections: [
        { id: 'contract', kind: 'facts', eyebrow: 'Key facts', title: 'The token, in numbers.', wallet: true, items: [
          { k: 'Contract', contract: true },
          { k: 'Network', v: 'Base', note: 'Ethereum layer 2' },
          { k: 'Name · symbol', v: 'Tracer · TRCR' },
          { k: 'Decimals', v: '18' },
          { k: 'Total supply', v: '12,500,000,000', note: TBC },
          { k: 'Minting', v: 'None after genesis', note: 'The whole supply was minted once. There is no mint function.' },
          { k: 'Burning', v: 'Supply only goes down', note: 'Holders can burn their own TRCR.' },
          { k: 'Voting', v: 'Delegate to vote', note: 'Votes count once delegated, even to yourself.' }] },
        { id: 'buy', kind: 'steps', eyebrow: 'How to buy', title: 'Buy TRCR in five steps.', items: [
          { t: 'Get a wallet on Base', d: 'Coinbase Wallet, MetaMask or Rabby all work.' },
          { t: 'Fund it with ETH on Base', d: 'Buy on an exchange that withdraws to Base, or bridge from Ethereum.' },
          { t: 'Open QuickSwap', d: 'Use the link on this page, so you land on the official pair.' },
          { t: 'Check the contract', d: 'Paste the address from this page. Ignore look-alike tokens.' },
          { t: 'Swap and add TRCR', d: 'Confirm the swap, then add TRCR to your wallet with the button above.' }],
          ctas: [{ label: 'Buy on QuickSwap', href: '@buy' }, { label: 'New to Base? Start here', href: 'base' }] },
        { id: 'airdrop', kind: 'prose', eyebrow: 'Airdrop', title: 'The TRCR airdrop on Base.', body: [
          'Everything about the drop is published here first.',
          { list: ['Who is eligible: ' + TBC, 'Snapshot: ' + TBC, 'How tokens arrive: ' + TBC, 'When: ' + TBC] },
          { warn: 'We will never DM you first, ask for your recovery phrase or send you to another site to claim. The only official contract is the one on this page.' }] },
        { id: 'distribution', kind: 'safes', eyebrow: 'Distribution', title: 'Five Safes hold the supply.', lede: ['Every TRCR outside circulation sits in a multisig Safe on Base, open for anyone to check.'], items: [
          { name: 'Tracer Foundation', purpose: 'Long-term stewardship of the project.' },
          { name: 'Team & advisors', purpose: 'The people building Tracer.' },
          { name: 'Ecosystem', purpose: 'Grants, partners and growth.' },
          { name: 'Treasury', purpose: 'Run by the DAO.' },
          { name: 'Early backers', purpose: 'Those who supported Tracer early.' }] },
        { id: 'faq', kind: 'faq', eyebrow: 'Token FAQ', title: 'Token questions.', groups: ['Token', 'Airdrop'], askTracy: true }
      ]
    },
    governance: {
      title: 'Governance: how the Tracer DAO works · Tracer',
      description: 'TRCR holders govern the Carrot protocol through an on-chain Governor and Timelock. What the DAO decides and how to take part.',
      head: { eyebrow: 'Governance', title: 'Tracer is run by its *holders*.', lede: ['TRCR holders steer the Carrot protocol through an on-chain Governor and Timelock. No admin keys, no back door: if it changes, it was voted.'],
        ctas: [{ label: 'How to take part', href: '#how' }, { label: 'Get TRCR', href: 'token' }],
        figure: { src: 'archive', caption: 'Fig. 1. The archive: every core is a tonne in the protocol, blue caps are retired. Holders decide the rules for all of it.' } },
      sections: [
        { id: 'decides', kind: 'steps', eyebrow: 'What the DAO decides', title: 'The rules of the market are a vote.', grid: true, items: [
          { t: 'Endorsers', d: 'Who may license carbon removal projects and endorse their credits, and who loses that right.' },
          { t: 'Payment tokens', d: 'Which stablecoins the marketplace and campaigns accept.' },
          { t: 'The marketplace', d: 'Listing currency, and closing or reopening project shops.' },
          { t: 'Safety switches', d: 'Pausing specific functions if something goes wrong.' },
          { t: 'Upgrades', d: 'Every contract upgrade passes through a vote and the Timelock.' },
          { t: 'Seed transfers', d: 'Whether pre-funding entitlements may change hands.' }] },
        { id: 'how', kind: 'steps', eyebrow: 'How to take part', title: 'Four steps from holder to voter.', items: [
          { t: 'Hold TRCR', d: 'On Base, in your own wallet.' },
          { t: 'Delegate', d: 'A one-time transaction. Delegate to yourself to vote yourself.' },
          { t: 'Vote or propose', d: 'Vote on live proposals; above the threshold, make your own.' },
          { t: 'The Timelock executes', d: 'Passed proposals queue, wait out the delay, then run.' }] },
        { id: 'params', kind: 'params', eyebrow: 'Parameters', title: 'The numbers behind a vote.', rows: [
          ['Voting token', 'TRCR (ERC20Votes, snapshot at proposal)'], ['Proposal threshold', TBC], ['Quorum', TBC], ['Voting delay', TBC],
          ['Voting period', TBC], ['Timelock delay', TBC], ['Where to vote', TBC]], note: 'Values are set for Base when the protocol launches on mainnet.' },
        { id: 'faq', kind: 'faq', eyebrow: 'Governance FAQ', title: 'Governance questions.', groups: ['Governance'], askTracy: true }
      ]
    },
    ecosystem: {
      title: 'Ecosystem: the Carrot protocol and where to go next · Tracer',
      description: 'How the Carrot protocol turns verified carbon removal into an on-chain asset, and where to find the marketplace, the Carbon Impact Scan, the academy and the news.',
      head: { eyebrow: 'Ecosystem', title: 'One protocol. Real carbon. Many ways *in*.', lede: ['Tracer governs the Carrot protocol. The carbon side of the project, from news to the marketplace, lives on Carbon Pioneers.'],
        ctas: [{ label: 'Where to go', href: '#gateways' }, { label: 'How it works', href: '#how' }] },
      sections: [
        { id: 'why', kind: 'prose', eyebrow: 'The RWA idea', title: 'Why carbon removal belongs on-chain.', body: [
          'Carbon credits have a trust problem: the same tonne can be counted twice, and retirements are hard to check.',
          'On the Carrot protocol each credit is endorsed once, issued as CRRT down to the gram and retired in public. **Anyone can follow a tonne from the project that removed it to the Rabbit that retired it.**'] },
        { id: 'how', kind: 'plates', eyebrow: 'How it works', title: 'Four steps, one *line*.', items: [
          { src: 'face', t: 'Endorsed', d: 'An Endorser admitted by the DAO checks the removal and endorses each credit ID once.' },
          { src: 'cut', t: 'Issued as CRRT', d: 'One slice is one gram; a million slices is a tonne. Seed campaigns can pre-fund a project.' },
          { src: 'ledger', t: 'Bought and recorded', d: 'Fixed-price listings in admitted stablecoins, no protocol fee. Every slice is a record on Base.' },
          { src: 'rabbit', t: 'Retired in a Rabbit', d: 'Retired for good, with beneficiary and purpose on record. It can never be counted again.' }] },
        { id: 'gateways', kind: 'cards', eyebrow: 'Where to go', title: 'Pick your way in.', items: [
          { title: 'Marketplace', body: 'Buy CRRT from endorsed removal projects.', status: 'Coming soon', href: '@carbonPioneers' },
          { title: 'Carbon Impact Scan', body: 'A guided scan of your footprint, then the credits to match.', status: 'Coming soon', href: '@carbonPioneers' },
          { title: 'Academy', body: 'Courses and certification for carbon buyers.', status: 'Later', href: '@carbonPioneers' },
          { title: 'News', body: 'Carbon removal news and market insight.', status: 'Live', href: '@carbonPioneers' }],
          note: 'Protocol stats (tonnes issued and retired, active projects) appear here after mainnet.' },
        { id: 'faq', kind: 'faq', eyebrow: 'Ecosystem FAQ', title: 'Ecosystem questions.', groups: ['Ecosystem'], askTracy: true }
      ]
    },
    base: {
      title: 'How to Base: wallet to TRCR in six steps · Tracer',
      description: 'New to Base? Set up a wallet, add the network, fund it with ETH and get TRCR on QuickSwap, step by step.',
      head: { eyebrow: 'How to Base', title: 'New to Base? *Start* here.', lede: ['Base is an Ethereum layer 2 incubated by Coinbase: Ethereum\'s security, transactions for cents. This guide takes you from no wallet to holding TRCR.'],
        ctas: [{ label: 'Start the guide', href: '#steps' }, { label: 'base.org', href: '@base' }] },
      sections: [
        { id: 'why', kind: 'facts', eyebrow: 'Why Base', title: 'Why Tracer chose Base.', items: [
          { k: 'Security', v: 'Settles to Ethereum', note: 'A layer 2 that posts its transactions to Ethereum.' },
          { k: 'Cost', v: 'Cents per transaction', note: 'Fees are paid in ETH on Base.' },
          { k: 'Wallets', v: 'Any EVM wallet', note: 'Coinbase Wallet, MetaMask, Rabby and more.' },
          { k: 'Reach', v: 'Easy on-ramps', note: 'Many exchanges withdraw straight to Base.' }] },
        { id: 'steps', kind: 'steps', eyebrow: 'The guide', title: 'Six steps to TRCR.', items: [
          { t: 'Install a wallet', d: 'Coinbase Wallet, MetaMask or Rabby. Write your recovery phrase on paper and keep it offline.' },
          { t: 'Add the Base network', d: 'Most wallets list Base already. If not, add it from base.org or chainlist.org.' },
          { t: 'Get ETH on Base', d: 'Buy ETH on an exchange and withdraw it on the Base network, or bridge it from Ethereum.' },
          { t: 'Open QuickSwap', d: 'Use the official link from our token page.' },
          { t: 'Swap ETH for TRCR', d: 'Paste the contract address from our token page, check it, then swap.' },
          { t: 'Add TRCR to your wallet', d: 'Use the button on the token page, or import the contract address.' }],
          ctas: [{ label: 'Go to the token page', href: 'token#contract' }] },
        { id: 'safety', kind: 'prose', eyebrow: 'Stay safe', title: 'Four rules that save wallets.', body: [
          { list: ['Never share your recovery phrase. Nobody legitimate will ask for it.', 'Only use the contract address on our token page.', 'The team never DMs first. Treat every DM as a scam.', 'Check every transaction before you sign it.'] }] },
        { id: 'faq', kind: 'faq', eyebrow: 'Base FAQ', title: 'Base questions.', groups: ['Base'], askTracy: true }
      ]
    },
    roadmap: {
      title: 'Roadmap · Tracer',
      description: 'Where Tracer is: the protocol is built and tested; next come the TRCR airdrop, the QuickSwap launch and mainnet on Base.',
      head: { eyebrow: 'Roadmap', title: 'Where Tracer is *heading*.', lede: ['Done, now, next, later. Dates are added as they are fixed.'] },
      sections: [
        { id: 'plan', kind: 'timeline', eyebrow: 'Milestones', title: 'The plan, in order.' }
      ]
    },
    about: {
      title: 'About Tracer',
      description: 'Why Tracer exists and the team building it.',
      head: { eyebrow: 'About', title: 'Built to make carbon removal *traceable*.', lede: ['Climate action needs carbon removal people can trust. Tracer puts every tonne on a public record, from the project that removed it to the moment it is retired.'],
        figure: { src: 'core', caption: 'Fig. 1. Specimen TRC-000 001: one tonne of carbon removal, before it is endorsed.' } },
      sections: [
        { id: 'mission', kind: 'prose', eyebrow: 'Mission', title: 'Why we are building Tracer.', body: [
          'Carbon removal will only scale if buyers can check what they pay for. Tracer makes the market\'s rules public and puts them in the hands of its holders.',
          { h: 'What we believe' },
          { list: ['One credit, counted once.', 'Retirements anyone can verify.', 'Rules set by those who hold the token, not by a back office.'] }] },
        { id: 'team', kind: 'team', eyebrow: 'Team', title: 'The people behind Tracer.', items: [
          { name: 'Profile coming soon', role: 'Founder' }, { name: 'Profile coming soon', role: 'Protocol engineering' },
          { name: 'Profile coming soon', role: 'Carbon markets' }, { name: 'Profile coming soon', role: 'Community' }],
          note: 'Team profiles are being added. ' + TBC, ctas: [{ label: 'Contact the team', href: 'contact' }] }
      ]
    },
    faq: {
      title: 'FAQ · Tracer',
      description: 'Answers about TRCR, the airdrop, governance, Base and the Carrot ecosystem.',
      head: { eyebrow: 'FAQ', title: 'Questions, *answered*.', lede: ['Search below, or ask Tracy in the corner.'] },
      sections: [{ id: 'all', kind: 'faq', search: true, grouped: true, askTracy: true }]
    },
    contact: {
      title: 'Contact · Tracer',
      description: 'Get in touch with the Tracer team.',
      head: { eyebrow: 'Contact', title: 'Talk to the *team*.', lede: ['Partnerships, press, projects that want to join the protocol, or anything else.'] },
      sections: [{ id: 'form', kind: 'contact', title: 'Send us a message.', topics: ['General', 'Partnership', 'Press', 'Carbon project', 'Token'],
        channels: [{ k: 'Email', v: 'To be confirmed' }, { k: 'Community', v: 'Links to follow' }, { k: 'Questions about TRCR', v: 'Read the FAQ', href: 'faq' }] }]
    },
    impressum: {
      title: 'Impressum · Tracer', description: 'Legal notice.',
      head: { eyebrow: 'Legal', title: 'Impressum.' },
      sections: [{ id: 'text', kind: 'prose', body: [
        { h: 'Provider' }, 'Company name: ' + TBC, 'Address: ' + TBC, 'Represented by: ' + TBC,
        { h: 'Contact' }, 'Email: ' + TBC, { h: 'Register' }, 'Register court and number: ' + TBC, 'VAT ID: ' + TBC] }]
    },
    privacy: {
      title: 'Privacy · Tracer', description: 'How this site handles your data.',
      head: { eyebrow: 'Legal', title: 'Privacy.' },
      sections: [{ id: 'text', kind: 'prose', body: [
        'Draft, to be reviewed before launch. ' + TBC,
        { h: 'What this site collects' },
        { list: ['No tracking cookies and no analytics.', 'Fonts are served from this site; no requests go to third-party font services.',
          'The contact form sends what you type to the team, only when you submit it.',
          'Tracy, the guide in the corner, answers from this site\'s FAQ inside your browser.',
          'Wallet actions (adding TRCR) happen in your own wallet; this site never sees your keys.'] },
        { h: 'Who is responsible' }, 'See the [Impressum](impressum).', { h: 'Your rights' }, 'You can ask what we hold about you, and ask us to delete it, by contacting us.'] }]
    },
    disclaimer: {
      title: 'Risk disclaimer · Tracer', description: 'Important information about TRCR and crypto assets.',
      head: { eyebrow: 'Legal', title: 'Risk disclaimer.' },
      sections: [{ id: 'text', kind: 'prose', body: [
        'Draft, to be reviewed before launch. ' + TBC,
        'Nothing on this site is financial, investment, legal or tax advice. TRCR is a governance token: it gives a vote in the Tracer DAO. It is not a share in a company and comes with no promise of profit.',
        { h: 'Know the risks' },
        { list: ['Crypto assets are volatile. You can lose everything you put in.', 'Smart contracts can contain bugs, even when tested and reviewed.',
          'Scammers copy tokens and sites. Only use the contract address on our token page.', 'Rules for crypto assets differ by country. Check what applies to you.'] }] }]
    }
  }
};
