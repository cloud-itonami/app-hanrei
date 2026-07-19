# hanrei XRPC Adapter

CF Worker that exposes the 31 kotoba commands across 10 tiers as XRPC endpoints.

## Endpoints

- **Jurisdiction**: `POST/GET .registerJurisdiction`, `GET .getJurisdiction`, `GET .listJurisdictions`
- **Court**: `POST .registerCourtProfiles`, `GET .listCourts`, `POST .collectWikidataCourts`
- **Case**: `POST .seedCases`, `GET .getCase`, `GET .listCases`, `GET .searchCases`
- **Law**: `POST .registerLaw`, `GET .getLaw`, `GET .listLaws`
- **Source**: `POST .registerSource`, `GET .getSource`, `GET .listSources`
- **Gazette**: `POST .registerGazetteEntry`, `GET .getGazetteEntry`, `GET .listGazetteEntries`
- **Digest**: `POST .registerDigest`, `GET .getDigest`
- **Hunt**: `POST .createInformationHunt`, `POST .receiveHuntResult`, `GET .listHuntResults`
- **Stats**: `GET .coverageStats`, `GET .huntCoverageStats`, `GET .compareJurisdictions`
- **Collect**: `GET .searchDecisions`, `POST .extractCasePersons`, `POST .collectCases`, `POST .collectCaseDetail`

## Setup

```bash
cd 60-apps/etzhayyim-project-hanrei/xrpc-adapter
npm install
```

## Development

```bash
npm run dev
# Worker listens on http://localhost:8787
```

## Example: Register Jurisdiction

```bash
curl -X POST http://localhost:8787/xrpc/com.etzhayyim.hanrei.registerJurisdiction \
  -H "Content-Type: application/json" \
  -d '{
    "jurisdictionCode": "JP-TYO",
    "name": "Tokyo District Court",
    "country": "JP",
    "tier": "district"
  }'
```

## Deploy

```bash
wrangler deploy
# Deploys to hanrei.etzhayyim.com/xrpc/*
```

See ADR-2605210000 for design context.
