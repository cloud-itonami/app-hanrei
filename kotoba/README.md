# hanrei kotoba

Phase E wave 3 Option B reference implementation of hanrei on the etzhayyim substrate.

Per [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md), hanrei was deferred during today's wave 1+2 because vendor src/app.ts uses `createKyselyDb()` (forbidden on etzhayyim per ADR-2605172000). Option B (PDS XRPC) is the per-actor decision.

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

All 31 commands now have kotoba reference impl. Wire-up to a Worker /
LangServer pod XRPC handler is the next operator task per ADR-2605203000.

## Pattern translation (Option B)

| Vendor | etzhayyim |
|---|---|
| `const db = createKyselyDb(env.HYPERDRIVE);` | `import type { Etzhayyim }` |
| `db.insertInto("vertex_hanrei_jurisdiction").values({...})` | `e.write({ collection: "com.etzhayyim.hanrei.jurisdiction", record, rkey })` |
| Read via SELECT … WHERE iso3 = ? | `e.read({ collection, rkey: \`jurisdiction-${iso3}\` })` |

Same idempotency pattern as ipaddress / tsukuru (rkey derived from natural key).

## Note on vendor stubs

Vendor's cmdGetJurisdiction / cmdListJurisdictions were already returning `[]` (TODO: vertex_jurisdiction not in @etzhayyim/graph-schema). The Option B rewrite is therefore behavior-preserving + finally functional — PDS XRPC writes work today without waiting for graph-schema additions.

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

## Related

- [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md) — Phase E decision matrix
- [ADR-2605172000](../../../90-docs/adr/2605172000-etzhayyim-kotoba-substrate.md) — kotoba substrate
- [ipaddress kotoba](../../etzhayyim-project-ipaddress/kotoba/) — Option B sibling reference (2/37 commands)
- [tsukuru kotoba](../../etzhayyim-project-tsukuru/kotoba/) — Option B full app (13/46 commands)
