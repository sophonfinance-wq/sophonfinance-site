# Site and demo regression tests

Plain Node (20 or later). One development dependency, `@babel/parser`, reads the demo bundles. Nothing in `tests/`,
`package.json` or `node_modules/` is loaded by the site.

```
npm ci                  # once
npm test                # everything below; the playback part runs a fast subset
npm run test:static     # everything except playback (no browser needed)
npm run test:playback   # playback for every demo at 1440, 500 and 390 px (about 15 minutes)
```

Single suites: `npm run test:content`, `test:consistency`, `test:reconcile`, `test:live`. Add `--verbose` (or
`VERBOSE=1`) to list every check and every hit. The suites read the working tree, so they can be run before a
commit; GitHub runs `npm test` on every push and pull request (`.github/workflows/tests.yml`).

## What is checked

**(a) Content** (`content.test.mjs`, no browser)
- "andfile" and other glued or split sentences in the demo bundles: JSX text next to an expression without a space
  ("review and" + {x}), or a sentence split into several text nodes ("review and " + {sign or file}), which text
  readers show as "andfile". Two deliberate patterns are allowed: the mail labels "To " / "Send to " + recipient, and
  plural endings (" invoice" + "s").
- Double spaces in each demo's page title and description and in its intro and home-note sentences.
- The maker line reads "Built by Enasal, with F1 Finance" (page, bundles and recorded data) in the tax and accounting
  demos (`MAKER_FAMILIES`; the audit family joins once its demos carry the new line).
- Every image, video, document and bundle a demo references (index.html, bundles, CSS, systems.json) exists with the
  exact same case and is tracked by git, because GitHub Pages is case-sensitive. Known absence:
  `brand/hero-loop.mp4` in the tax and accounting demos is not shipped on purpose; `demo/tweaks.js` catches the
  failed load and keeps the poster image. Files that exist but are not committed yet (a fresh rebuild) are listed
  as a note; files ignored by git fail.
- The listed terms (`lib/terms.mjs`) over everything a demo can show: bundle strings, recorded data, systems.json,
  active narration captions (cues moved to "parked", with or without correctedText, are not spoken and not scanned), and the text of its xlsx, docx, pdf and eml files. The rules
  are the storyline's company-form rules (HANGS Construction Services LLC is a C corporation: board, officers,
  shareholders, dividends) and its lookalike rules; the patterns are stored rot13-encoded, as in the client-systems
  generator, so the repository carries none of the listed words. Allowed: the audit firm's engagement partner and a
  law firm's partner (roles), companies whose legal names end in "Partners LLC" (customers and vendors), and bare
  numbers in ids and cells (spreadsheet row ids such as 1446). Encoded data (base64, data: URIs) is not scanned, so
  letter pairs inside image data never count. The rules include the older audit design's leftover names.

**(b) Consistency** (`consistency.test.mjs`)
- Audit: every FY2026 revenue, net income, materiality, performance materiality and clearly trivial figure stated in
  the 13 audit demos' recorded data and active narration equals `demo/audit-canonical.json` (the interim review may
  state its own, labelled, interim figures), and the canonical derived values follow the plan. Strict for all 13.
- Form 940 vs Forms W-2/W-3: the 940's Q4 ($3,070,530.56: October paid plus November and December projected)
  reconciles to the W-2 Q4 ($3,147,237.56) to the cent; the $76,707.00 difference is all November and December
  ($80,963.00 more for existing staff, $4,256.00 less for the planned hire, FUTA -$23.76); the planned hire is the
  same person in both demos; the 940 figures panel says "Q4 is projected" and every Q4 tape row reads "Projected · ...".
- Workers' comp (tax-lni): the rates document's base and experience-rated parts add to each class's rate, the rated
  parts are base x experience factor, the client-systems copy shows the same tables, and the run's premium uses those
  rates ($111,469.07 premium, $92,296.72 employer share).
- Ties between demos from the client-systems datasets: Form 941 Q3 ledger wages and deposits, the W-2 ledger's Q3 pay
  runs vs the 941, W-3 box 1, the 940 ledger vs the W-2 ledger, Form 1120 dividends to Celeste Whitford = her Form
  1040 dividends, and one entity record across every demo.

**(c) Reconciliation** (`reconcile.test.mjs`), recomputed from `demo/<id>/systems.json` and the recorded workpapers
- Trial balances foot (debits = credits, balance columns net to zero, opening + activity = closing per account,
  preliminary + adjustments = adjusted). Trial balances that show only the review's accounts are checked row by row.
- Balance sheets balance: assets = liabilities + equity + current-year income.
- Ledgers made of whole journal entries: every journal balances; every proposed entry balances.
- Bank reconciliation: both sides recomputed from their lines, difference $0.00; every "Unexplained difference" is $0.00.
- 13-week cash: each week opens with the prior week's ending cash, opening + receipts + disbursements = ending, totals
  add, the workbook's proof is $0.00, and week 1 opens at the October bank rec's adjusted balance.

**(d) Live calculations** (`live/`): each "Try your own numbers" calculation (`demo/live/calc/`) reproduces its
recorded run on unchanged inputs and recomputes edits correctly (941, 1040, bank rec, AP review, 13-week cash).

**(e) Playback** (`playback/playback.mjs`): headless Chrome, Chromium or Edge over the DevTools Protocol. One tap runs
the replay; a document close-up has a close button and Escape closes only it; after Skip to Results nothing covers the
results for 12 seconds and the results stay up; Reopen document, Client Systems and Try your own numbers each open over
the results and Escape closes only the topmost one; Escape never closes the results or restarts the replay; narration
captions sit below the replay window; the close button exits; no console errors. `npm test` runs tax-941, tax-1099,
tax-1040 and accounting (AP review) at 1440 px and tax-941 at 390 px. Set `CHROME_PATH` to choose the browser. Without a
browser the playback part is skipped, except under `CI=true`.

## Expected failures

A check that is known to fail until another piece of work lands stays strict (it fails the run) but is printed as
`EXPECTED UNTIL FIXED: <reason>`, and says so once it passes. Current list:

- `content.test.mjs` → `TERMS_PENDING`: listed terms still in the audit demos (the J-2619 and J-2625 job names, which the
  tax demos now show as "Rainier Commons Building B" and "Juniper Ridge Business Park, 9 flex buildings", and one
  wording in the audit intro). They clear once the audit design data takes the same renames.

## Known, not tested

- The audit demos' footer and intro still read "Built by Enasal, with Sophon Finance" until they are rebuilt; add
  audit to `MAKER_FAMILIES` in content.test.mjs then.
