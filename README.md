# Tracer website

The Tracer site: 12 static pages, built from one content file. The home page is **the specimen**: a stone core on a
lab bench, drawn live in WebGL (three.js). Scrolling follows one tonne of carbon removal through its life:
measured → endorsed → cut → recorded on Base → retired → governed. The other pages are documents in the same
visual language. Their illustrations are rendered from the same 3D scene.

Structure and audiences: `../tracer-website/STRUCTURE.md`.

## Run it

```bash
npm install          # Playwright only (for figures and QA); the site itself has no dependencies
npm run build        # content/ + src/ -> dist/, then checks every link, image and #anchor
npm run serve        # http://127.0.0.1:4300/
npm run figures      # re-render assets/figures/*.jpg from the home page's scene (after changing the scene)
npm run qa           # every page on desktop + phone: errors, overflow, a11y basics, interactions -> .qa/
node tools/shots.mjs [--phone]   # stills of each home-page chapter -> .qa/home-*.jpg
```

`dist/` is plain static files and works on any host (Vercel, Netlify, S3, nginx). There is no server code.

## Where things are

| Path | What |
|---|---|
| `content/site.mjs` | **All the words**: nav, footer, FAQ, Tracy, every page's sections, the roadmap, links, token facts |
| `content/specimen.mjs` | The home page's 3D direction: positions on the bench and one scroll key per chapter state |
| `content/marks.json` | The Tracer wordmark and mark as vector paths (traced from the logo files) |
| `src/render/index.mjs` | Renders every page to HTML at build time (real text in the DOM: SEO, screen readers, no-JS) |
| `src/js/site.js` | Every page: header, phone menu, copy contract, add to wallet, FAQ search, Tracy, contact form |
| `src/js/home/` | The specimen: `app.js` (camera, callouts, the cutter, intro), `scene/bench.js`, `scene/stone.js` |
| `src/runtime/` | WebGL runtime (app, params, scroll choreography, post, text effects) from the Nalikes 3d-builder; three.js r149 (MIT) |
| `src/styles/` | `base.css` (every page), `home.css` (the specimen) |
| `assets/` | Self-hosted fonts (OFL: Newsreader, IBM Plex Sans/Mono), logo SVGs, figures |
| `tools/` | build, serve, figures, qa, shots |

### Editing copy
Edit `content/site.mjs` and run `npm run build`. Conventions:
- `**bold**` for emphasis.
- `*word*` in a headline is the blue italic accent.
- `[label](token#buy)` links to another page.
- `@buy` points at `site.links.buy`.
- `{tbc}` renders a yellow **TBC** marker.

The build counts the TBC markers (currently 42).

## Still to supply (TBC on the site)
| Item | Where it goes | From |
|---|---|---|
| TRCR mainnet contract address | `site.token.address` (fills every contract chip, enables Copy / Add to wallet) | team |
| Total supply confirmation (12.5B) and allocation per Safe | `site.token.supply`, `pages.token` → `distribution.items[].share/address` | Tracer team |
| Five Safe addresses | `pages.token` → `distribution.items[].address` | Michiel / Hans |
| Airdrop details (eligibility, snapshot, claim, date) | `pages.token` → `airdrop` | Luc / Hans |
| QuickSwap referral link | `site.links.buy.href` | Luc |
| Governance parameters on Base and voting UI | `pages.governance` → `params` | team |
| Tracy embed | `site.tracy.embed` (replaces the FAQ-based preview) | Michiel |
| Rabbit mascot (Tracy avatar) | `assets/…` + `site.tracy.avatar` | design files |
| Roadmap dates | `site.roadmap[].when` | Luc |
| Team profiles | `pages.about` → `team` | team |
| Impressum details, privacy and risk texts reviewed | `pages.impressum/privacy/disclaimer` | Luc / counsel |
| Contact email and a form endpoint | `pages.contact`, `src/js/site.js` (form) | team |
| Domain | `site.url` (canonical links, sitemap); set `site.noindex = false` at launch | Luc |
| Carbon Pioneers URLs | `site.links.carbonPioneers` | Michiel |

## The specimen: why everything moves

The rule is that objects only move when something happens to them in the story. Otherwise only the camera moves, to
look at what the copy is about. The story reads left to right along the bench: core → cut → buyer and ledger → Rabbit.
Each chapter holds its state while you read it, and the changes happen between chapters.

| Element / motion | When | Why |
|---|---|---|
| Stone core | always, never moves | one tonne of carbon removal; the white veins are the stored carbon |
| Laser ring | measure, engrave, cut | the protocol's hand; on only while the protocol acts on the stone |
| One measuring pass on load | intro | measuring the tonne; the specimen card counts 0 → 1.000000 t with it |
| Camera to the end face | ch. 01 | the endorsement is written on the face |
| Mark engraved into the face | ch. 01 (scroll) | endorsed once, permanently, can't be reused |
| Camera back to the whole core | ch. 02 | you choose how much of the whole tonne to cut |
| Laser follows the drag / slider | ch. 02 | CRRT is divisible to the gram; readout and cut agree |
| Slice cut off, travels right along the bench | → ch. 03 | ownership moves to the buyer; the camera follows it |
| Slice turns its face | ch. 03 | every slice keeps its endorsement and history |
| Faint dot grid | ch. 03 | the existing ledger on Base (others' records) |
| Grains rise into one blue block | ch. 03 (scroll) | the physical slice becomes its records |
| Ledger fades back | ch. 04 | focus moves to retirement; the record still exists |
| Slice lowered into the glass Rabbit, lid seals, inner light | ch. 04 (scroll) | retired for good; the light confirms the seal |
| Camera rises, archive fades in | ch. 05 | from one tonne to all of them: governance covers the whole market |
| Camera holds through the TRCR chapter | ch. 06 | nothing new to show |
| Small lean with the pointer | always | a depth cue: it's a real object |

Legibility: copy columns sit on a paper scrim, callouts are paper chips, and the hero text fades before it can slide
over the stone. On phones the bench sits in the top of the screen, the copy below it, and the long extras (record
table, steps) stay on the full pages.

## Privacy and performance
- No analytics and no cookies.
- Fonts are self-hosted, so the site makes no requests to Google or any other third party.
- Document pages don't load WebGL.
- The home page stops drawing once the paper sections cover it, and has quality tiers and dynamic resolution.
- It has a no-WebGL fallback (a figure as the poster) and a reduced-motion mode.
