# hanrei XRPC Adapter

CF Worker that exposes the 31 kotoba commands across 10 tiers as XRPC endpoints
at `https://hanrei.etzhayyim.com/xrpc/com.etzhayyim.hanrei.<cmd>`.

Operator-facing entry point for the whole repo:
[`../docs/operator-quickstart.md`](../docs/operator-quickstart.md).

## Endpoints

- **Jurisdiction**: `POST .registerJurisdiction`, `GET .getJurisdiction`, `GET .listJurisdictions`
- **Court**: `POST .registerCourtProfiles`, `GET .listCourts`, `POST .collectWikidataCourts`
- **Case**: `POST .seedCases`, `GET .getCase`, `GET .listCases`, `GET .searchCases`
- **Law**: `POST .registerLaw`, `GET .getLaw`, `GET .listLaws`
- **Source**: `POST .registerSource`, `GET .getSource`, `GET .listSources`
- **Gazette**: `POST .registerGazetteEntry`, `GET .getGazetteEntry`, `GET .listGazetteEntries`
- **Digest**: `POST .registerDigest`, `GET .getDigest`
- **Hunt**: `POST .createInformationHunt`, `POST .receiveHuntResult`, `GET .listHuntResults`
- **Stats**: `GET .coverageStats`, `GET .huntCoverageStats`, `GET .compareJurisdictions`
- **Collect**: `GET .searchDecisions`, `POST .extractCasePersons`, `POST .collectCases`, `POST .collectCaseDetail`

## Setup — read this before you run `npm install`

```bash
cd xrpc-adapter    # relative to the repo root, not to a monorepo 60-apps/ path
npm install
```

**That install does not succeed as the tree stands.** `package.json` declares
`"@etzhayyim/hanrei-kotoba": "workspace:*"`, and this repo has no root
`package.json` and no `workspaces` field anywhere — the specifier has nothing to
resolve against:

```
$ npm install --package-lock-only --offline
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

It is a leftover from the `etzhayyim/root` monorepo this repo was migrated out
of. Getting the Worker running again means either adding a workspace root here or
replacing the specifier with a file/git reference; neither has been done.

`npm run dev` (`wrangler dev`, port 8787) and `npm run deploy` (`wrangler deploy`)
are therefore not reachable from a clean checkout, and neither has been executed
against this tree.

## Environment

`src/index.ts` builds the SDK from these bindings. The request's
`Authorization: Bearer …` is extracted on every call and passed to
`createAuthedEtzhayyim` alongside them:

| Binding | Required | Note |
|---|---|---|
| `ACTOR_DID` | yes | `did:web:hanrei.etzhayyim.com` |
| `PDS_URL` | yes | |
| `L2_RPC_URL` | yes | |
| `PDS_ACCESS_JWT` / `PDS_REFRESH_JWT` | optional | passed through when set |

## Example: register a jurisdiction

Input is passed straight through to the kotoba function, so the body is
`RegisterJurisdictionInput` (`../kotoba/src/types.ts`) — `iso3` and `name` are
required and `iso3` must be exactly three characters:

```bash
curl -X POST http://localhost:8787/xrpc/com.etzhayyim.hanrei.registerJurisdiction \
  -H "Content-Type: application/json" \
  -d '{
    "iso3": "JPN",
    "name": "Japan",
    "nameLocal": "日本国",
    "legalSystem": "civil-law",
    "primaryLanguage": "ja",
    "caseLawSource": "courts.go.jp"
  }'
```

Earlier revisions of this file showed a body of
`{jurisdictionCode, name, country, tier}`. No such fields exist on the input
type; that request returns `{"status":"rejected","error":"missingRequiredFields"}`.

Court-level detail belongs to the court tier (`registerCourtProfiles`), not to
the jurisdiction tier.

## Design context

ADR-2605210000 (first execution-layer demonstration). That ADR lives in
`etzhayyim/root`, not in this repo.
