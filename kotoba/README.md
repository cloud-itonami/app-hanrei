# hanrei kotoba

Phase E wave 3 Option B reference implementation of hanrei on the etzhayyim substrate.

Operator-facing entry point for the whole repo:
[`../docs/operator-quickstart.md`](../docs/operator-quickstart.md).

Per ADR-2605203000, hanrei was deferred during wave 1+2 because vendor
`src/app.ts` used `createKyselyDb()` (forbidden on etzhayyim per ADR-2605172000).
Option B (PDS XRPC) is the per-actor decision. **Those two ADRs live in
`etzhayyim/root`, not in this repo and not in the `com-junkawasaki` superproject
`90-docs/adr/`** — earlier revisions of this file linked them as
`../../../90-docs/adr/*.md`, which resolves to nothing from here.

Coverage: **31 of 31 (100%)** hanrei XRPC commands ported.

| Tier | Commands | Slice |
|---|---|---|
| jurisdiction | registerJurisdiction, getJurisdiction, listJurisdictions | 1 |
| court | registerCourtProfiles (bulk), listCourts, collectWikidataCourts | 2 |
| case | seedCases (bulk), getCase, listCases, searchCases | 3 |
| law | registerLaw, getLaw, listLaws | 4 |
| source | registerSource, getSource, listSources | 5 |
| gazette | registerGazetteEntry, getGazetteEntry, listGazetteEntries | 6 |
| digest | registerDigest, getDigest | 7 |
| hunt | createInformationHunt, receiveHuntResult, listHuntResults | 8 |
| stats | coverageStats, huntCoverageStats, compareJurisdictions | 9 |
| collect | searchDecisions, extractCasePersons, collectCases, collectCaseDetail | **10** |

Wire-up to a Worker / LangServer pod XRPC handler is the next operator task per
ADR-2605203000; `../xrpc-adapter/` is that Worker.

## Tests

```bash
npm_config_userconfig=/dev/null npm install --cache /tmp/hanrei-npm-cache
npm test           # vitest, 24 it() blocks in test/hanrei.test.ts
npm run typecheck  # tsc --noEmit
```

Plain `npm install` fails on npm >= 11 if your `~/.npmrc` has an `allow-scripts[]`
entry, and again if another `npm` on the machine is using the shared cache —
hence the two prefixes above. Even past both, the two declared git dependencies
expand to **eight**, each cloned and `tsc`-compiled before npm links anything;
that step ran 15 minutes without finishing on the workstation this note was
written from, so **`npm test` and `npm run typecheck` were never reached here.**
The counts above are read off the source, not off a run.
`../docs/operator-quickstart.md` has the exact errors.

## Pattern translation (Option B)

| Vendor | etzhayyim |
|---|---|
| `const db = createKyselyDb(env.HYPERDRIVE);` | `import type { Etzhayyim }` |
| `db.insertInto("vertex_hanrei_jurisdiction").values({...})` | `e.write({ collection: "com.etzhayyim.hanrei.jurisdiction", record, rkey })` |
| Read via SELECT … WHERE iso3 = ? | `e.read({ collection, rkey: \`jurisdiction-${iso3}\` })` |

Same idempotency pattern as ipaddress / tsukuru (rkey derived from natural key).

⚠ The natural-key derivation lowercases and then maps every character outside
`[a-z0-9]` to `-`, in this tier and in court / case / law / source / gazette.
It is therefore **not injective**: `jp.kanpo`, `jp_kanpo` and `jp-kanpo` all
produce `source-jp-kanpo` while carrying different DIDs. Keep identifiers inside
`[a-z0-9-]`.

## Note on vendor stubs

Vendor's cmdGetJurisdiction / cmdListJurisdictions were already returning `[]`
(TODO: vertex_jurisdiction not in @etzhayyim/graph-schema). The Option B rewrite
is therefore behavior-preserving + finally functional — PDS XRPC writes work
without waiting for graph-schema additions.

## Authority chain (per hanrei CLAUDE.md)

```
did:web:hanrei.etzhayyim.com                       — controller
did:web:hanrei.etzhayyim.com:jurisdiction:{iso3}   ← this slice
did:web:hanrei.etzhayyim.com:court:{jurisdiction}:{courtId}
did:web:hanrei.etzhayyim.com:case:{caseId}
did:web:hanrei.etzhayyim.com:law:{lawId}
```

## Usage

```ts
import { Etzhayyim } from "@etzhayyim/sdk";
import {
  registerJurisdiction,
  getJurisdiction,
  listJurisdictions,
} from "@etzhayyim/hanrei-kotoba";

const e = new Etzhayyim({
  did: "did:web:hanrei.etzhayyim.com",
  pdsUrl: "https://pds.etzhayyim.com",
  // session or auth
});

const out = await registerJurisdiction(e, {
  iso3: "JPN",
  name: "Japan",
  nameLocal: "日本国",
  legalSystem: "civil-law",
  primaryLanguage: "ja",
  caseLawSource: "courts.go.jp",
});
// → { status: "registered", jurisdictionUri, did: "did:web:hanrei.etzhayyim.com:jurisdiction:jpn" }

const got = await getJurisdiction(e, { iso3: "JPN" });
// → { jurisdiction: { iso3: "jpn", name: "Japan", ... } }
```

`iso3` and `name` are required and `iso3` must be exactly 3 characters; anything
else returns `{ status: "rejected", error: "missingRequiredFields" | "iso3MustBe3Chars" }`
rather than throwing.

## Related

- `../xrpc-adapter/` — the CF Worker that exposes these 31 functions as XRPC
- ADR-2605203000 (Phase E decision matrix) and ADR-2605172000 (kotoba substrate)
  — both in `etzhayyim/root`
- ipaddress / tsukuru kotoba — Option B siblings; they migrated out of the same
  monorepo into their own repos, so there is no relative path to them from here
