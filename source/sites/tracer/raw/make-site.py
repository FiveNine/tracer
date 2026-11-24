"""Write sites/tracer/site.json: the copy (from the structure brief), the marks and the line's scroll keys.

  python3 make-site.py

Keys are made from each section's stage so every page reads the same way: the line arrives as a section's top
passes 40% of the screen, holds while it is read, then re-routes for the next one.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
marks = json.load(open(os.path.join(HERE, 'marks-svg.json')))

TBC = '{tbc}'
LINKS = {
    'buy': {'label': 'Buy TRCR', 'href': 'https://quickswap.exchange/'},          # referral link: Luc is checking with QuickSwap
    'explorer': {'label': 'Basescan', 'href': 'https://basescan.org'},
    'base': {'label': 'base.org', 'href': 'https://base.org'},
    'carbonPioneers': {'label': 'Carbon Pioneers', 'href': 'https://endglobalwarming.net'},
    'docs': {'label': 'Docs', 'href': 'https://docs.endglobalwarming.net'},
}

# ---- the line's shapes: natural width (world units) for fitting ----
WIDTH = {'sweep': .44, 'thread': 4.96, 'tracyArt': 2.24, 'tracy': 3.05, 'word': 6.15, 'pillars': 5.4, 'route': 6.1, 'ring': 3.6, 'loop': 4.3, 'blocks': 4.7, 'hub': 4.5, 'timeline': 2.2, 'mark': 1.95, 'wave': 14, 'rule': 8}
HEIGHT = {'sweep': 8.1, 'thread': 4.03, 'tracyArt': 3.6, 'tracy': 3.6, 'word': 1.3, 'pillars': 1.5, 'route': 2.7, 'ring': 3.6, 'loop': 3.2, 'blocks': 2.0, 'hub': 3.0, 'timeline': 5.8, 'mark': 3.0, 'wave': .5, 'rule': .1}


def kind(s):
    return s if isinstance(s, str) else s['kind']


def pose(stage, shape, k, tone):
    """params for one section: where the line sits and how big it is"""
    w, h = WIDTH[kind(shape)], HEIGHT[kind(shape)]
    t = 0 if tone == 'blue' else 1
    if stage == 'hero':      # the wordmark, centred above the headline
        d = {'line.x': 0, 'line.y': .5, 'line.s': .9, 'line.alpha': 1, 'pulse.amt': .9, 'line.ry': 0, 'line.rx': 0}
        n = {'line.x': 0, 'line.y': .45, 'line.s': round(2.25 / w, 3)}
    elif stage == 'sweep':   # stood up across a pinned photo; the section's extra keys move it (sec(..., sweep=...))
        d = {'line.x': shape['from'], 'line.y': 0, 'line.s': 1, 'line.alpha': 1, 'pulse.amt': .7, 'line.ry': 0, 'line.rx': 0}
        n = {'line.x': shape['nFrom'], 'line.y': -.5, 'line.s': .42}
    elif stage in ('right', 'left'):
        s = round(min(1.0, 3.8 / w, 3.7 / h), 3)
        tilt = .16 if k % 2 else -.16      # alternate, so the line sways in depth from chapter to chapter
        if kind(shape) == 'tracyArt': tilt = 0   # flat to the screen: her colours fill in exactly under the line
        if kind(shape) == 'thread': s, tilt = .93, .1   # the windows want room: larger than the diagrams were
        d = {'line.x': .5 if stage == 'right' else -.5, 'line.y': 0, 'line.s': s, 'line.alpha': 1, 'pulse.amt': .8, 'line.ry': tilt, 'line.rx': .06 if tilt else 0}
        n = {'line.x': 0, 'line.y': .46, 'line.s': round(min(2.1 / w, 2.0 / h), 3), 'line.ry': tilt * .4, 'line.rx': 0}
        if kind(shape) == 'thread': n.update({'line.y': .47, 'line.s': .48})
    elif stage == 'quiet':   # a calm wave along the foot of the screen behind long reads
        d = {'line.x': 0, 'line.y': -.82, 'line.s': 1, 'line.alpha': .45, 'pulse.amt': .35, 'line.ry': 0, 'line.rx': 0}
        n = {'line.y': -.9}
    else:                    # hidden
        d = {'line.alpha': 0, 'pulse.amt': 0}   # it only fades where it is (moving it would drag the tokenize boundary as that chapter leaves)
        n = {}
    d.update({'line.shape': k, 'tone': t})
    return d, n


def keys_of(sections, shapes, cta_tone='blue'):
    out, keyof = [], {}
    for i, s in enumerate(sections):
        d, n = pose(s['_stage'], shapes[s['_k']], s['_k'], s.get('tone', 'paper'))
        k = {'at': '#' + s['id'], 'set': d}
        keyof[i] = k
        if n: k['narrow'] = n
        if i > 0: k.update({'shift': '-18vh', 'hold': s.get('_hold', .45)})   # arrives as the section settles into view; _hold: how long the previous pose stays
        out.append(k)
        sh = shapes[s['_k']]
        if s['_stage'] == 'sweep':
            # the tokenize chapter draws its own line (scene/tokenize.js): the wordmark keeps its hero pose and is carried
            # up and away with the hero (app.js carry()), fading only once it is off screen
            prev = out[-2]
            out[-1] = {'at': '#' + s['id'], 'ease': 'inQuart', 'asFirst': True, 'set': dict(prev['set'], **{'line.alpha': 0, 'pulse.amt': 0})}
            if 'narrow' in prev: out[-1]['narrow'] = dict(prev['narrow'])
    # a hidden chapter waits, out of sight, exactly where the next visible chapter will show the same shape, so the line
    # appears there (drawn in, for drawIn shapes) instead of sliding into place
    POS = ('line.x', 'line.y', 'line.s', 'line.rx', 'line.ry')
    for i, s in enumerate(sections):
        if s['_stage'] != 'hidden': continue
        nxt = next((j for j in range(i + 1, len(sections)) if sections[j]['_stage'] != 'hidden'), None)
        if nxt is None or sections[nxt]['_k'] != s['_k']: continue
        k, kn = keyof[i], keyof[nxt]
        k['set'].update({n: kn['set'][n] for n in POS if n in kn['set']})
        if 'narrow' in kn: k['narrow'] = dict(k.get('narrow', {}), **{n: kn['narrow'][n] for n in POS if n in kn['narrow']})
    return out   # the footer has its own ground; the line is carried up with the last section (app.js carry())


def sec(id, kind_, tone, stage, k, **kw):
    """a section: its kind of block, the world's tone, the line's stage (hero|right|left|quiet|hidden) and shape index"""
    css_stage = {'hero': 'center', 'sweep': 'none', 'right': 'right', 'left': 'left', 'quiet': 'none', 'hidden': 'none'}[stage]
    d = {'id': id, 'kind': kind_, 'tone': tone, 'stage': css_stage, '_stage': stage, '_k': k}
    d.update(kw)
    return d


def page(title, description, shapes, sections, tags=(), art=()):
    keys = keys_of(sections, shapes)
    for s in sections:
        s.pop('_stage'); s.pop('_k'); s.pop('_hold', None)
    return {'title': title, 'description': description, 'sections': sections, 'tags': list(tags), 'art': list(art)}, {'shapes': shapes, 'keys': keys}


TL_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8']
TL_LABELS = ['Testnet', 'Website', 'Airdrop', 'QuickSwap', 'Mainnet', 'Marketplace', 'Impact Scan', 'Academy']
SAFES = [('f1', 'Foundation', 'up'), ('f2', 'Team & advisors', 'down'), ('f3', 'Ecosystem', 'down'), ('f4', 'Treasury', 'down'), ('f5', 'Early backers', 'up')]


def tags_ring(k):
    return [{'id': i, 'k': k, 'label': l, **({'flip': True} if f == 'flip' else {'pos': f} if f else {})} for i, l, f in SAFES] + [{'id': 'ringc', 'k': k, 'label': 'TRCR', 'pos': 'mid'}]


def tags_route(k):
    return [{'id': 's1', 'k': k, 'label': '01 Project', 'pos': 'up'}, {'id': 's2', 'k': k, 'label': '02 CRRT', 'pos': 'up'}, {'id': 's3', 'k': k, 'label': '03 Market', 'pos': 'up'}, {'id': 's4', 'k': k, 'label': '04 Rabbit', 'pos': 'down'}]


def tags_loop(k):
    return [{'id': 'g1', 'k': k, 'label': 'Hold', 'pos': 'up'}, {'id': 'g2', 'k': k, 'label': 'Delegate', 'pos': 'up'}, {'id': 'g3', 'k': k, 'label': 'Vote', 'pos': 'down'}, {'id': 'g4', 'k': k, 'label': 'Execute', 'pos': 'down'}]


def tags_hub(k):
    return [{'id': 'e1', 'k': k, 'label': 'Marketplace', 'pos': 'up'}, {'id': 'e2', 'k': k, 'label': 'Impact Scan', 'pos': 'up'}, {'id': 'e3', 'k': k, 'label': 'Academy', 'pos': 'down'}, {'id': 'e4', 'k': k, 'label': 'News', 'pos': 'down'}, {'id': 'hub', 'k': k, 'label': 'Carrot', 'pos': 'mid'}]


def tags_timeline(k):
    return [{'id': i, 'k': k, 'label': l} for i, l in zip(TL_IDS, TL_LABELS)]   # vertical run: labels to the right


PLACES = [
                {'title': 'Mangroves', 'img': 'photos/mangrove-portal.webp', 'body': 'Coastal forests lock carbon into their roots and the mud beneath them.',
                 'credit': 'Photo: Priyaflorenceshah, [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Mangrove_forests_of_Mumbai.jpg)'},
                {'title': 'Reforestation', 'img': 'photos/forest-portal.webp', 'body': 'Trees planted on cleared land draw carbon down as they grow.',
                 'credit': 'Photo: Sidoine Mbogni, [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Vue_a%C3%A9rienne_de_la_for%C3%AAt_tropicale_%C3%A0_Bodiman,_Yabassi,_Cameroun.jpg)'},
                {'title': 'Enhanced weathering', 'img': 'photos/basalt-portal.webp', 'body': 'Crushed basalt spread on fields binds CO₂ into stable minerals as it weathers.',
                 'credit': 'Photo: Andy Waddington, [CC BY-SA 2.0](https://commons.wikimedia.org/wiki/File:Basalt_columns,_west_coast_of_Kerrera_-_geograph.org.uk_-_1754060.jpg)'},
                {'title': 'Biochar', 'img': 'photos/biochar-portal.webp', 'body': 'Plant waste heated without oxygen becomes a stable char that holds carbon in soil for centuries.',
                 'credit': 'Photo: Tim Brunauer / GIZ, [CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Charged_and_inoculated_biochar_ready_for_soil_application.jpg)'}]

pages, xpages = {}, {}

# ---------------------------------------------------------------- home
# The line is the hero's wordmark, then the light that tokenizes a real removal project as it sweeps across it, then a
# fly-through of removal places (no line there); it steps back for the reading chapters and returns to draw Tracy.
shapes = ['word',
          {'kind': 'sweep', 'photo': 'photos/biochar.webp', 'from': .78, 'to': .02, 'nFrom': .8, 'nTo': -.55},
          {'kind': 'tracyArt', 'fill': 'tracyFill', 'drawIn': '#faq'}, 'mark']
pages['index'], xpages['index'] = page(
    'Tracer: carbon removal, traced on-chain', 'Tracer is a real-world asset project on Base. TRCR holders govern the Carrot protocol, where verified carbon removal is issued, traded and retired on-chain.',
    shapes, [
        sec('hero', 'hero', 'blue', 'hero', 0, full=True, title='Leave No Trace.',
            lede=['Tracer turns verified carbon removal into an on-chain asset on Base, and retires it for good. TRCR holders run it.'],
            ctas=[{'label': 'Buy TRCR', 'href': '@buy'}, {'label': 'Learn about TRCR', 'href': 'token', 'ghost': True}], stageBox=True),
        sec('rwa', 'tokenize', 'blue', 'sweep', 1, eyebrow='How the RWA works', title='The world, made on-chain.',
            lede=['Where the line passes, verified carbon removal becomes **CRRT**: an asset on Base you can hold, trade and retire. Every dot is a gram.'],
            items=[
                {'title': 'Licensed and endorsed', 'body': 'Endorsers admitted by the DAO license removal projects and endorse their credits.'},
                {'title': 'Issued as CRRT', 'body': 'Projects issue CRRT against endorsed removal. One slice is one gram; a million slices is a tonne.'},
                {'title': 'Bought on the marketplace', 'body': 'Fixed-price listings in admitted stablecoins. No protocol fees.'},
                {'title': 'Retired in a Rabbit', 'body': 'Send CRRT into a Rabbit and it is retired for good, with its beneficiary on record.'}],
            counter='grams on-chain · 1,000,000 = one tonne'),
        sec('projects', 'portal', 'blue', 'hidden', 2, full=True, eyebrow='Real-world assets', title='Every tonne has a place.',
            lede=['Each CRRT comes from a real removal project you can look into: where it is, who endorsed it, how much has been issued and how much is retired.'],
            items=PLACES,
            ctas=[{'label': 'Explore the ecosystem', 'href': 'ecosystem', 'ghost': True}],
            note='The kinds of removal behind CRRT. Endorsed projects are listed on the marketplace at launch.'),
        sec('token', 'coin', 'paper', 'hidden', 2, full=True, eyebrow='The token', title='What is TRCR?',
            lede=['The governance token of the Carrot protocol, on Base. Hold it, delegate it, vote with it.'],
            items=[{'title': 'Vote on the protocol', 'tag': 'Governance', 'href': 'governance'},
                   {'title': 'Delegate your votes', 'tag': 'Guide', 'href': 'governance#how'},
                   {'title': 'Get it in the airdrop', 'tag': 'Next', 'href': 'token#airdrop'},
                   {'title': 'Buy on QuickSwap', 'tag': 'At launch', 'href': '@buy'}],
            facts=[{'k': 'Network', 'v': 'Base'}, {'k': 'Supply', 'v': '12.5B'}, {'k': 'Minting', 'v': 'Never'}], chip=True),
        sec('governance', 'timelock', 'paper', 'hidden', 2, full=True, eyebrow='Governance', title='Hold. Delegate. Vote. _Wait._ Execute.', items=[
            {'title': 'Hold TRCR', 'body': 'Your tokens are your voting weight.'},
            {'title': 'Delegate', 'body': 'To yourself or someone you trust. Votes only count once delegated.'},
            {'title': 'Vote or propose', 'body': 'On Endorsers, payment tokens, the marketplace and upgrades.'},
            {'title': 'The Timelock executes', 'body': 'A passed proposal waits in public before it runs on-chain. No back door.'}],
            dial={'label': 'Timelock · example proposal', 'caption': 'until it can run on-chain', 'secs': 101520, 'total': 172800},
            ctas=[{'label': 'How governance works', 'href': 'governance', 'ghost': True}]),
        sec('base', 'cta', 'paper', 'hidden', 2, eyebrow='Built on Base', title='Ethereum security, at cents a move.', lede=['Base is an Ethereum layer 2 incubated by Coinbase. New to it? The guide takes you from no wallet to holding TRCR in six steps.'],
            items=[], ctas=[{'label': 'How to Base', 'href': 'base'}]),
        sec('ecosystem', 'cards', 'paper', 'hidden', 2, eyebrow='Ecosystem', title='Where to go next.', items=[
            {'title': 'Marketplace', 'body': 'Buy CRRT from endorsed projects.', 'status': 'Coming soon', 'href': '@carbonPioneers'},
            {'title': 'Carbon Impact Scan', 'body': 'Find your footprint, then remove it.', 'status': 'Coming soon', 'href': '@carbonPioneers'},
            {'title': 'Academy', 'body': 'Courses on buying carbon removal.', 'status': 'Later', 'href': '@carbonPioneers'},
            {'title': 'News', 'body': 'Carbon removal news and market insight.', 'status': 'Live', 'href': '@carbonPioneers'}],
            note='These live on Carbon Pioneers, the carbon side of the project.'),
        sec('roadmap', 'cta', 'paper', 'hidden', 2, eyebrow='Roadmap', title='Built, tested, and next up.', lede=['The protocol is built and tested on testnet. Next: the airdrop, the QuickSwap launch and mainnet on Base.'], items=[],
            ctas=[{'label': 'See the roadmap', 'href': 'roadmap', 'ghost': True}]),
        sec('faq', 'faq', 'paper', 'right', 2, full=True, eyebrow='FAQ · Ask Tracy', title='Questions? Ask Tracy.',
            lede=['Tracy is Tracer\'s guide, in the corner of every page. The questions people ask most are right here.'], limit=5, askTracy=True,
            ctas=[{'label': 'All questions', 'href': 'faq', 'ghost': True}]),
        sec('join', 'cta', 'paper', 'right', 3, full=True, _hold=.85, eyebrow='Take part', title='Hold it. Vote with it. Trace it.', ctas=[{'label': 'Buy TRCR', 'href': '@buy'}, {'label': 'Governance', 'href': 'governance', 'ghost': True}], chip=True),
    ],
    )   # Tracy (k 2) is drawn by the line, then the line fills her blue areas (tracyFill)

# ---------------------------------------------------------------- token
shapes = ['mark']   # the line is the homepage's; here it stays out of sight
pages['token'], xpages['token'] = page(
    'TRCR token: contract, airdrop, how to buy · Tracer', 'The official TRCR guide: contract address, how to buy on QuickSwap, the airdrop on Base and the five Safes that hold the supply.',
    shapes, [
        sec('top', 'coin', 'paper', 'hidden', 0, full=True, h1=True, eyebrow='TRCR token', title='Everything about TRCR, in one place.',
            lede=['The contract, how to buy, the airdrop and where every token sits. If someone sent you here with a question, the answer is on this page.'],
            items=[{'title': 'The contract and key facts', 'tag': 'Facts', 'href': '#contract'}, {'title': 'Buy TRCR in five steps', 'tag': 'How to buy', 'href': '#buy'},
                   {'title': 'The airdrop on Base', 'tag': 'Airdrop', 'href': '#airdrop'}, {'title': 'Where every token sits', 'tag': 'Five Safes', 'href': '#distribution'}],
            facts=[{'k': 'Network', 'v': 'Base'}, {'k': 'Supply', 'v': '12.5B'}, {'k': 'Minting', 'v': 'Never'}], chip=True),
        sec('contract', 'facts', 'paper', 'hidden', 0, eyebrow='Key facts', title='The token, in numbers.', wallet=True, items=[
            {'k': 'Contract', 'contract': True},
            {'k': 'Network', 'v': 'Base', 'note': 'Ethereum layer 2'},
            {'k': 'Name · symbol', 'v': 'Tracer · TRCR'},
            {'k': 'Decimals', 'v': '18'},
            {'k': 'Total supply', 'v': '12,500,000,000', 'note': TBC},
            {'k': 'Minting', 'v': 'None after genesis', 'note': 'The whole supply was minted once. There is no mint function.'},
            {'k': 'Burning', 'v': 'Supply only goes down', 'note': 'Holders can burn their own TRCR.'},
            {'k': 'Voting', 'v': 'Delegate to vote', 'note': 'Votes count once delegated, even to yourself.'}]),
        sec('buy', 'steps', 'paper', 'hidden', 0, eyebrow='How to buy', title='Buy TRCR in five steps.', items=[
            {'title': 'Get a wallet on Base', 'body': 'Coinbase Wallet, MetaMask or Rabby all work.'},
            {'title': 'Fund it with ETH on Base', 'body': 'Buy on an exchange that withdraws to Base, or bridge from Ethereum.'},
            {'title': 'Open QuickSwap', 'body': 'Use the link on this page, so you land on the official pair.'},
            {'title': 'Check the contract', 'body': 'Paste the address from this page. Ignore look-alike tokens.'},
            {'title': 'Swap and add TRCR', 'body': 'Confirm the swap, then add TRCR to your wallet with the button above.'}],
            ctas=[{'label': 'Buy on QuickSwap', 'href': '@buy'}, {'label': 'New to Base? Start here', 'href': 'base', 'ghost': True}]),
        sec('airdrop', 'prose', 'paper', 'hidden', 0, full=True, eyebrow='Airdrop', title='The TRCR airdrop on Base.', body=[
            'Everything about the drop is published here first.',
            {'list': ['Who is eligible: ' + TBC, 'Snapshot: ' + TBC, 'How tokens arrive: ' + TBC, 'When: ' + TBC]},
            '**We will never DM you first, ask for your seed phrase or send you to another site to claim.** The only official contract is the one on this page.']),
        sec('distribution', 'ledger', 'paper', 'hidden', 0, eyebrow='Distribution', title='Nothing hidden.', lede=['Every TRCR was minted once, at genesis. Everything outside circulation sits in five multisig Safes on Base, open for anyone to check.'],
            metrics=[{'k': 'Total supply', 'v': '12.5B', 'note': 'TRCR on Base ' + TBC}, {'k': 'Minted since genesis', 'v': '0', 'accent': True, 'note': 'There is no mint function'},
                     {'k': 'Held in', 'v': '5 Safes', 'note': 'Multisigs, listed below'}, {'k': 'Burns', 'v': 'Only down', 'note': 'Holders can burn their own'}],
            note='Allocations per Safe are published with the addresses at launch.', items=[
            {'name': 'Tracer Foundation', 'purpose': 'Long-term stewardship of the project.'},
            {'name': 'Team & advisors', 'purpose': 'The people building Tracer.'},
            {'name': 'Ecosystem', 'purpose': 'Grants, partners and growth.'},
            {'name': 'Treasury', 'purpose': 'Run by the DAO.'},
            {'name': 'Early backers', 'purpose': 'Those who supported Tracer early.'}]),
        sec('faq', 'faq', 'paper', 'hidden', 0, eyebrow='Token FAQ', title='Token questions.', groups=['Token', 'Airdrop'], askTracy=True),
    ])

# ---------------------------------------------------------------- governance
shapes = ['mark']   # the line is the homepage's; here it stays out of sight
pages['governance'], xpages['governance'] = page(
    'Governance: how the Tracer DAO works · Tracer', 'TRCR holders govern the Carrot protocol through an on-chain Governor and Timelock. What the DAO decides and how to take part.',
    shapes, [
        sec('top', 'timelock', 'paper', 'hidden', 0, full=True, h1=True, eyebrow='Governance', title='Hold. Delegate. Vote. _Wait._ Execute.',
            lede=['TRCR holders steer the Carrot protocol through an on-chain Governor and Timelock. No admin keys, no back door: if it changes, it was voted.'],
            items=[{'title': 'Hold TRCR', 'body': 'On Base, in your own wallet.'},
                   {'title': 'Delegate', 'body': 'A one-time transaction. Delegate to yourself to vote yourself.'},
                   {'title': 'Vote or propose', 'body': 'Vote on live proposals; above the threshold, make your own.'},
                   {'title': 'The Timelock executes', 'body': 'Passed proposals queue, wait out the delay in public, then run.'}],
            dial={'label': 'Timelock · example proposal', 'caption': 'until it can run on-chain', 'secs': 101520, 'total': 172800},
            ctas=[{'label': 'Get TRCR', 'href': 'token'}, {'label': 'The parameters', 'href': '#params', 'ghost': True}]),
        sec('decides', 'steps', 'paper', 'hidden', 0, eyebrow='What the DAO decides', title='The rules of the market are a vote.', items=[
            {'title': 'Endorsers', 'body': 'Who may license carbon removal projects and endorse their credits, and who loses that right.'},
            {'title': 'Payment tokens', 'body': 'Which stablecoins the marketplace and campaigns accept.'},
            {'title': 'The marketplace', 'body': 'Listing currency, and closing or reopening project shops.'},
            {'title': 'Safety switches', 'body': 'Pausing specific functions if something goes wrong.'},
            {'title': 'Upgrades', 'body': 'Every contract upgrade passes through a vote and the Timelock.'},
            {'title': 'Seed transfers', 'body': 'Whether pre-funding entitlements may change hands.'}]),
        sec('params', 'params', 'paper', 'hidden', 0, eyebrow='Parameters', title='The numbers behind a vote.', rows=[
            ['Voting token', 'TRCR (ERC20Votes, snapshot at proposal)'], ['Proposal threshold', TBC], ['Quorum', TBC], ['Voting delay', TBC],
            ['Voting period', TBC], ['Timelock delay', TBC], ['Where to vote', TBC]],
            note='Values are set for Base when the protocol launches on mainnet.'),
        sec('faq', 'faq', 'paper', 'hidden', 0, eyebrow='Governance FAQ', title='Governance questions.', groups=['Governance'], askTracy=True),
    ])

# ---------------------------------------------------------------- base
shapes = ['mark']   # the line is the homepage's; here it stays out of sight
pages['base'], xpages['base'] = page(
    'How to Base: wallet to TRCR in six steps · Tracer', 'New to Base? Set up a wallet, add the network, fund it with ETH and get TRCR on QuickSwap, step by step.',
    shapes, [
        sec('top', 'dots', 'paper', 'hidden', 0, full=True, glyph='L2', eyebrow='How to Base', title='New to Base? Start here.',
            lede=['Base is an Ethereum layer 2 incubated by Coinbase: Ethereum\'s security, transactions for cents. This guide takes you from no wallet to holding TRCR.'],
            ctas=[{'label': 'Start the guide', 'href': '#steps'}, {'label': 'base.org', 'href': '@base', 'ghost': True}]),
        sec('why', 'facts', 'paper', 'hidden', 0, eyebrow='Why Base', title='Why Tracer chose Base.', items=[
            {'k': 'Security', 'v': 'Settles to Ethereum', 'note': 'A layer 2 that posts its transactions to Ethereum.'},
            {'k': 'Cost', 'v': 'Cents per transaction', 'note': 'Fees are paid in ETH on Base.'},
            {'k': 'Wallets', 'v': 'Any EVM wallet', 'note': 'Coinbase Wallet, MetaMask, Rabby and more.'},
            {'k': 'Reach', 'v': 'Easy on-ramps', 'note': 'Many exchanges withdraw straight to Base.'}]),
        sec('steps', 'steps', 'paper', 'hidden', 0, eyebrow='The guide', title='Six steps to TRCR.', items=[
            {'title': 'Install a wallet', 'body': 'Coinbase Wallet, MetaMask or Rabby. Write your recovery phrase on paper and keep it offline.'},
            {'title': 'Add the Base network', 'body': 'Most wallets list Base already. If not, add it from base.org or chainlist.org.'},
            {'title': 'Get ETH on Base', 'body': 'Buy ETH on an exchange and withdraw it on the Base network, or bridge it from Ethereum.'},
            {'title': 'Open QuickSwap', 'body': 'Use the official link from our token page.'},
            {'title': 'Swap ETH for TRCR', 'body': 'Paste the contract address from our token page, check it, then swap.'},
            {'title': 'Add TRCR to your wallet', 'body': 'Use the button on the token page, or import the contract address.'}],
            ctas=[{'label': 'Go to the token page', 'href': 'token#contract'}]),
        sec('safety', 'prose', 'paper', 'hidden', 0, full=True, eyebrow='Stay safe', title='Four rules that save wallets.', body=[
            {'list': ['Never share your recovery phrase. Nobody legitimate will ask for it.', 'Only use the contract address on our token page.', 'The team never DMs first. Treat every DM as a scam.', 'Check every transaction before you sign it.']}]),
        sec('faq', 'faq', 'paper', 'hidden', 0, eyebrow='Base FAQ', title='Base questions.', groups=['Base'], askTracy=True),
    ])

# ---------------------------------------------------------------- ecosystem
shapes = ['mark']   # the line is the homepage's; here it stays out of sight
pages['ecosystem'], xpages['ecosystem'] = page(
    'Ecosystem: the Carrot protocol and where to go next · Tracer', 'How the Carrot protocol turns verified carbon removal into an on-chain asset, and where to find the marketplace, the Carbon Impact Scan, the academy and the news.',
    shapes, [
        sec('top', 'portal', 'paper', 'hidden', 0, full=True, h1=True, eyebrow='Ecosystem', title='One protocol. Real carbon. Many ways in.',
            lede=['Tracer governs the Carrot protocol. The carbon side of the project, from news to the marketplace, lives on Carbon Pioneers.'],
            items=PLACES, ctas=[{'label': 'Where to go', 'href': '#gateways', 'ghost': True}]),
        sec('why', 'prose', 'paper', 'hidden', 0, eyebrow='The RWA idea', title='Why carbon removal belongs on-chain.', body=[
            'Carbon credits have a trust problem: the same tonne can be counted twice, and retirements are hard to check.',
            'On the Carrot protocol each credit is endorsed once, issued as CRRT down to the gram and retired in public. **Anyone can follow a tonne from the project that removed it to the Rabbit that retired it.**']),
        sec('how', 'steps', 'paper', 'hidden', 0, full=True, eyebrow='How it works', title='Five parts, one market.', items=[
            {'title': 'Endorsers', 'body': 'Admitted by the DAO. They license projects and endorse each credit once.'},
            {'title': 'CRRT', 'body': 'The carbon asset. One slice is one gram; a million slices is a tonne.'},
            {'title': 'Seed campaigns', 'body': 'Back a project before delivery and receive its CRRT as it is issued.'},
            {'title': 'Marketplace', 'body': 'Fixed-price listings, paid in one transaction, with no protocol fees.'},
            {'title': 'Rabbits', 'body': 'Retirement containers. CRRT sent in is retired for good.'}]),
        sec('gateways', 'cards', 'paper', 'hidden', 0, full=True, eyebrow='Where to go', title='Pick your way in.', items=[
            {'title': 'Marketplace', 'body': 'Buy CRRT from endorsed removal projects.', 'status': 'Coming soon', 'href': '@carbonPioneers'},
            {'title': 'Carbon Impact Scan', 'body': 'A guided scan of your footprint, then the credits to match.', 'status': 'Coming soon', 'href': '@carbonPioneers'},
            {'title': 'Academy', 'body': 'Courses and certification for carbon buyers.', 'status': 'Later', 'href': '@carbonPioneers'},
            {'title': 'News', 'body': 'Carbon removal news and market insight.', 'status': 'Live', 'href': '@carbonPioneers'}],
            note='Protocol stats (tonnes issued and retired, active projects) go live here after mainnet.'),
        sec('faq', 'faq', 'paper', 'hidden', 0, eyebrow='Ecosystem FAQ', title='Ecosystem questions.', groups=['Ecosystem'], askTracy=True),
    ])

# ---------------------------------------------------------------- roadmap
shapes = ['mark']   # the line is the homepage's; here it stays out of sight
pages['roadmap'], xpages['roadmap'] = page(
    'Roadmap · Tracer', 'Where Tracer is: the protocol is built and tested; next come the TRCR airdrop, the QuickSwap launch and mainnet on Base.',
    shapes, [
        sec('top', 'dots', 'paper', 'hidden', 0, full=True, glyph='→', eyebrow='Roadmap', title='Where Tracer is heading.', lede=['What is done, what is happening now and what comes next. Dates are added as they are fixed.'],
            ctas=[{'label': 'See the milestones', 'href': '#plan'}]),
        sec('plan', 'timeline', 'paper', 'hidden', 0, eyebrow='Milestones', title='The plan, in order.', items=[
            {'when': '2026', 'state': 'done', 'title': 'Carrot protocol built and tested', 'body': 'Contracts, governance and the indexer, tested on testnet.'},
            {'when': 'Nov 2026', 'state': 'now', 'title': 'The new Tracer site', 'body': 'One place for the token, governance and the ecosystem.'},
            {'when': 'TBC', 'state': 'next', 'title': 'TRCR airdrop on Base', 'body': 'Distribution from the five Safes.'},
            {'when': 'TBC', 'state': 'next', 'title': 'TRCR on QuickSwap', 'body': 'Open trading on Base.'},
            {'when': 'TBC', 'state': 'next', 'title': 'Carrot protocol on mainnet', 'body': 'Governance, issuance and retirement live on Base.'},
            {'when': 'TBC', 'state': 'next', 'title': 'Marketplace on Carbon Pioneers', 'body': 'Buy CRRT from endorsed projects.'},
            {'when': 'TBC', 'state': 'later', 'title': 'Carbon Impact Scan', 'body': 'A guided scan from footprint to removal.'},
            {'when': 'TBC', 'state': 'later', 'title': 'Academy', 'body': 'Courses and certification for carbon buyers.'}]),
    ])

# ---------------------------------------------------------------- about
shapes = ['mark']   # the line is the homepage's; here it stays out of sight
pages['about'], xpages['about'] = page(
    'About Tracer', 'Why Tracer exists and the team building it.',
    shapes, [
        sec('top', 'dots', 'paper', 'hidden', 0, full=True, img='mark-blue.svg', eyebrow='About', title='Built to make carbon removal traceable.',
            lede=['Climate action needs carbon removal people can trust. Tracer puts every tonne on a public line, from the project that removed it to the moment it is retired.']),
        sec('mission', 'prose', 'paper', 'hidden', 0, eyebrow='Mission', title='Why we are building Tracer.', body=[
            'Carbon removal will only scale if buyers can check what they pay for. Tracer makes the market\'s rules public and puts them in the hands of its holders.',
            {'h': 'What we believe'},
            {'list': ['One credit, counted once.', 'Retirements anyone can verify.', 'Rules set by those who hold the token, not by a back office.']}]),
        sec('team', 'team', 'paper', 'hidden', 0, eyebrow='Team', title='The people behind Tracer.', items=[
            {'name': 'Profile coming soon', 'role': 'Founder'}, {'name': 'Profile coming soon', 'role': 'Protocol engineering'},
            {'name': 'Profile coming soon', 'role': 'Carbon markets'}, {'name': 'Profile coming soon', 'role': 'Community'}],
            note='Team profiles are being added.', ctas=[{'label': 'Contact the team', 'href': 'contact', 'ghost': True}]),
    ])

# ---------------------------------------------------------------- faq
shapes = ['mark']   # the line is the homepage's; here it stays out of sight
pages['faq'], xpages['faq'] = page(
    'FAQ · Tracer', 'Answers about TRCR, the airdrop, governance, Base and the Carrot ecosystem.',
    shapes, [
        sec('top', 'dots', 'paper', 'hidden', 0, compact=True, glyph='?', eyebrow='FAQ', title='Questions, answered.', lede=['Search below, or ask Tracy in the corner.']),
        sec('all', 'faq', 'paper', 'hidden', 0, title='', search=True, grouped=True, askTracy=True),
    ])

# ---------------------------------------------------------------- contact
shapes = ['mark']   # the line is the homepage's; here it stays out of sight
pages['contact'], xpages['contact'] = page(
    'Contact · Tracer', 'Get in touch with the Tracer team.',
    shapes, [
        sec('top', 'dots', 'paper', 'hidden', 0, compact=True, glyph='@', eyebrow='Contact', title='Talk to the team.', lede=['Partnerships, press, projects that want to join the protocol, or anything else.']),
        sec('form', 'contact', 'paper', 'hidden', 0, title='Send us a message.', topics=['General', 'Partnership', 'Press', 'Carbon project', 'Token'],
            channels=[{'k': 'Email', 'v': 'To be confirmed', 'href': '#'}, {'k': 'Community', 'v': 'Links to follow', 'href': '#'}, {'k': 'Questions about TRCR', 'v': 'Read the FAQ', 'href': 'faq'}]),
    ])

# ---------------------------------------------------------------- legal
LEGAL_SHAPES = ['mark']   # the line is the homepage's; here it stays out of sight
pages['impressum'], xpages['impressum'] = page('Impressum · Tracer', 'Legal notice.', LEGAL_SHAPES, [
    sec('top', 'dots', 'paper', 'hidden', 0, compact=True, glyph='§', eyebrow='Legal', title='Impressum.'),
    sec('text', 'prose', 'paper', 'hidden', 0, title='', body=[
        {'h': 'Provider'}, 'Company name: ' + TBC, 'Address: ' + TBC, 'Represented by: ' + TBC,
        {'h': 'Contact'}, 'Email: ' + TBC, {'h': 'Register'}, 'Register court and number: ' + TBC, 'VAT ID: ' + TBC]),
])
pages['privacy'], xpages['privacy'] = page('Privacy · Tracer', 'How this site handles your data.', LEGAL_SHAPES, [
    sec('top', 'dots', 'paper', 'hidden', 0, compact=True, glyph='§', eyebrow='Legal', title='Privacy.'),
    sec('text', 'prose', 'paper', 'hidden', 0, title='', body=[
        'Draft, to be reviewed before launch. ' + TBC,
        {'h': 'What this site collects'},
        {'list': ['No tracking cookies and no analytics.', 'The contact form sends what you type to the team, only when you submit it.',
                  'Tracy, the guide in the corner, answers from this site\'s FAQ inside your browser.',
                  'Wallet actions (adding TRCR) happen in your own wallet; this site never sees your keys.']},
        {'h': 'Who is responsible'}, 'See the [Impressum](impressum.html).', {'h': 'Your rights'}, 'You can ask what we hold about you, and ask us to delete it, by contacting us.']),
])
pages['disclaimer'], xpages['disclaimer'] = page('Risk disclaimer · Tracer', 'Important information about TRCR and crypto assets.', LEGAL_SHAPES, [
    sec('top', 'dots', 'paper', 'hidden', 0, compact=True, glyph='§', eyebrow='Legal', title='Risk disclaimer.'),
    sec('text', 'prose', 'paper', 'hidden', 0, title='', body=[
        'Draft, to be reviewed before launch. ' + TBC,
        'Nothing on this site is financial, investment, legal or tax advice. TRCR is a governance token: it gives a vote in the Tracer DAO. It is not a share in a company and comes with no promise of profit.',
        {'h': 'Know the risks'},
        {'list': ['Crypto assets are volatile. You can lose everything you put in.', 'Smart contracts can contain bugs, even when tested and reviewed.',
                  'Scammers copy tokens and sites. Only use the contract address on our token page.', 'Rules for crypto assets differ by country. Check what applies to you.']}]),
])

# ---------------------------------------------------------------- shared content
faq = [
    ('Token', 'What is TRCR?', ['TRCR is Tracer\'s governance token on Base. Holders use it to propose and vote on how the Carrot protocol runs.'], ['token', 'trcr']),
    ('Token', 'What is the official contract address?', ['It is published on the [token page](token.html#contract) at launch, and nowhere else. Always check it before you buy.'], ['contract', 'address', 'ca']),
    ('Token', 'Where can I buy TRCR?', ['On QuickSwap, on Base. Use the link on our [token page](token.html#buy) so you land on the official pair.'], ['buy', 'quickswap', 'swap', 'purchase']),
    ('Token', 'What is the total supply?', ['12,500,000,000 TRCR {tbc}, all minted once at genesis. There is no mint function, so supply can never go up; burns can only bring it down.'], ['supply', 'tokenomics', 'mint', 'burn']),
    ('Token', 'Where are the tokens held?', ['In five Safes: Tracer Foundation, Team & advisors, Ecosystem, Treasury and Early backers. Their addresses are published on the token page.'], ['safe', 'safes', 'distribution', 'allocation', 'wallets']),
    ('Token', 'Is TRCR an investment?', ['TRCR gives you a vote in the Tracer DAO. It is not a share in a company and promises no return. Crypto assets are volatile; read the [risk disclaimer](disclaimer.html).'], ['invest', 'price', 'profit']),
    ('Airdrop', 'Who gets the airdrop?', ['Eligibility will be published on the [token page](token.html#airdrop) before the drop {tbc}.'], ['airdrop', 'eligible', 'eligibility']),
    ('Airdrop', 'Do I need to claim the airdrop?', ['How tokens arrive will be published on the token page {tbc}. We will never ask for your recovery phrase or send you to another site to claim.'], ['claim', 'airdrop']),
    ('Airdrop', 'Someone sent me a DM about the airdrop. Is it real?', ['No. The team never sends the first message. Only trust the links on this site.'], ['dm', 'scam', 'message']),
    ('Governance', 'How do I vote?', ['Hold TRCR and delegate your votes, to yourself or someone you trust. Votes only count after delegating. Then vote on live proposals.'], ['vote', 'voting', 'dao']),
    ('Governance', 'Why do I have to delegate to myself?', ['TRCR counts voting power at the moment a proposal is made, and only for delegated tokens. Delegating to yourself is a one-time transaction.'], ['delegate', 'delegation']),
    ('Governance', 'What can the DAO decide?', ['Which Endorsers may license carbon projects, which stablecoins are accepted, how the marketplace runs, pauses and contract upgrades.'], ['dao', 'decide', 'proposal', 'governance']),
    ('Base', 'What is Base?', ['An Ethereum layer 2 incubated by Coinbase. It settles to Ethereum and keeps fees to cents.'], ['base', 'layer', 'l2', 'network']),
    ('Base', 'Which wallet should I use?', ['Any EVM wallet that supports Base, such as Coinbase Wallet, MetaMask or Rabby. See [How to Base](base.html).'], ['wallet', 'metamask', 'coinbase']),
    ('Base', 'What does a transaction cost?', ['Usually a few cents, paid in ETH on Base.'], ['fee', 'fees', 'gas', 'cost']),
    ('Ecosystem', 'What is CRRT?', ['The Carrot protocol\'s carbon asset. One slice is one gram of endorsed carbon removal; a million slices is a tonne.'], ['crrt', 'credit', 'carbon']),
    ('Ecosystem', 'What is a Rabbit?', ['A retirement container. CRRT sent into a Rabbit is retired permanently, with its beneficiary and purpose on record. It can never be taken back out.'], ['rabbit', 'retire', 'retirement', 'offset']),
    ('Ecosystem', 'Where can I buy carbon credits?', ['On the Carbon Pioneers marketplace, coming soon. The Carbon Impact Scan will guide you from your footprint to the right credits.'], ['marketplace', 'buy', 'credits', 'scan']),
]

content = {
    'links': LINKS,
    'token': {'symbol': 'TRCR', 'name': 'Tracer', 'network': 'Base', 'address': '', 'decimals': 18, 'addressPending': 'Contract published at launch'},
    'nav': [{'label': 'Token', 'href': 'token'}, {'label': 'Governance', 'href': 'governance'}, {'label': 'Ecosystem', 'href': 'ecosystem'},
            {'label': 'How to Base', 'href': 'base'}, {'label': 'Roadmap', 'href': 'roadmap'}, {'label': 'About', 'href': 'about'}],
    'footer': {
        'tagline': 'Carbon removal, traced on-chain. A real-world asset project on Base, governed by TRCR holders.',
        'columns': [
            {'title': 'Tracer', 'links': [{'label': 'Token', 'href': 'token'}, {'label': 'Governance', 'href': 'governance'}, {'label': 'Roadmap', 'href': 'roadmap'}, {'label': 'About', 'href': 'about'}]},
            {'title': 'Learn', 'links': [{'label': 'How to Base', 'href': 'base'}, {'label': 'Ecosystem', 'href': 'ecosystem'}, {'label': 'FAQ', 'href': 'faq'}, {'label': 'Docs', 'href': '@docs'}]},
            {'title': 'Elsewhere', 'links': [{'label': 'Carbon Pioneers', 'href': '@carbonPioneers'}, {'label': 'Buy on QuickSwap', 'href': '@buy'}, {'label': 'Base', 'href': '@base'}, {'label': 'Basescan', 'href': '@explorer'}]},
            {'title': 'Company', 'links': [{'label': 'Contact', 'href': 'contact'}, {'label': 'Impressum', 'href': 'impressum'}, {'label': 'Privacy', 'href': 'privacy'}, {'label': 'Risk disclaimer', 'href': 'disclaimer'}]}],
        'small': '© 2026 Tracer',
        'risk': 'Crypto assets are volatile and you can lose what you put in. Nothing here is financial advice. [Read the risk disclaimer](disclaimer.html).'},
    'announce': {'label': 'TRCR airdrop on Base', 'text': 'Details coming soon', 'href': 'token#airdrop'},
    'tracy': {'name': 'Tracy', 'role': 'Tracer guide', 'avatar': 'tracy-face.png', 'hello': 'Hi! Ask me about TRCR',
              'greeting': 'Hi, I\'m Tracy. Ask me about TRCR, the airdrop, governance or Base.',
              'suggestions': ['What is TRCR?', 'How do I buy TRCR?', 'How do I vote?', 'What is a Rabbit?'],
              'placeholder': 'Ask about TRCR, Base, voting…',
              'note': 'Preview: Tracy answers from this site\'s FAQ, in your browser. The full assistant is coming soon.',
              'fallback': 'I don\'t have an answer for that yet. Try the FAQ, or contact the team.'},
    'forms': {'sent': 'Thanks. This preview isn\'t connected to a mailbox yet, so nothing was sent.'},
    'faq': [{'group': g, 'q': q, 'a': a, 'tags': t} for g, q, a, t in faq],
    'pages': pages,
}

site = {
    'template': 'trace', 'slug': 'tracer', 'lang': 'en',
    'meta': {'title': 'Tracer: carbon removal, traced on-chain', 'description': 'Tracer is a real-world asset project on Base. TRCR holders govern the Carrot protocol.', 'noindex': True},
    'brand': {'name': 'Tracer', 'wordmark': marks['word'], 'mark': marks['mark'], 'favicon': 'assets/mark-blue.svg'},
    'theme': {'mode': 'light',
              'colors': {'bg': '#0657ff', 'fg': '#ffffff', 'muted': '#4a5675', 'line': 'rgba(11,21,51,.12)', 'accent': '#0657ff', 'accent2': '#d9f1ff', 'surface': '#ffffff',
                         'blue': '#0657ff', 'paper': '#f4f6fb', 'ink': '#0b1533', 'inkmuted': '#4a5675', 'hotOnBlue': '#bfe3ff', 'hotOnPaper': '#002fa8'},
              'fonts': {'sans': {'family': 'Space Grotesk', 'package': 'space-grotesk', 'weights': [400, 500, 600]},
                        'mono': {'family': 'JetBrains Mono', 'package': 'jetbrains-mono', 'weights': [500]}}},
    'content': content,
    'experience': {'look': {'preset': 'editorial', 'tonemap': 'linear', 'vignette': 0, 'grain': 0.012, 'bloom': 0.06}, 'modules': [], 'pages': xpages},
}
json.dump(site, open(os.path.join(HERE, '..', 'site.json'), 'w'), indent=1, ensure_ascii=False)
print('site.json: pages', list(pages))
