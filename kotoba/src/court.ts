/**
 * hanrei kotoba — court tier (slice 2, +3 commands → 6/31).
 *
 *   registerCourtProfiles   — bulk register courts under a jurisdiction
 *   listCourts              — list courts (optional jurisdiction filter)
 *   collectWikidataCourts   — collect court entities from Wikidata (Phase 2 stub)
 *
 * Court DID hierarchy:
 *   did:web:hanrei.etzhayyim.com:court:{jurisdiction}:{courtId}
 *
 * Per ADR-2605203000 Option B (PDS XRPC).
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  HANREI_DID_PREFIX,
  type CourtRecord,
  type CourtView,
  type CollectWikidataCourtsInput,
  type CollectWikidataCourtsOutput,
  type ListCourtsInput,
  type ListCourtsOutput,
  type RegisterCourtProfilesInput,
  type RegisterCourtProfilesOutput,
} from "./types.js";

const COURT_COLLECTION = "com.etzhayyim.hanrei.court";

function courtDid(jurisdiction: string, courtId: string): string {
  return `${HANREI_DID_PREFIX}court:${jurisdiction.toLowerCase()}:${courtId.toLowerCase()}`;
}

function courtRkey(jurisdiction: string, courtId: string): string {
  return `court-${jurisdiction.toLowerCase()}-${courtId.toLowerCase()}`;
}

/**
 * Bulk register court profiles. Each court is idempotent via
 * rkey = "court-{jurisdiction}-{courtId}".
 */
export async function registerCourtProfiles(
  e: Etzhayyim,
  input: RegisterCourtProfilesInput
): Promise<RegisterCourtProfilesOutput> {
  if (!input.jurisdiction || !input.courts || input.courts.length === 0) {
    return { status: "rejected", error: "missingRequiredFields" };
  }

  const registered: { courtId: string; courtUri: string; did: string }[] = [];
  const skipped: { courtId: string; reason: string }[] = [];

  for (const c of input.courts) {
    if (!c.courtId || !c.name) {
      skipped.push({ courtId: c.courtId ?? "", reason: "missingId" });
      continue;
    }
    const rkey = courtRkey(input.jurisdiction, c.courtId);
    const existing = await e
      .read<CourtRecord>({ collection: COURT_COLLECTION, rkey })
      .catch(() => ({ records: [] }));
    if (existing.records[0]?.value) {
      skipped.push({ courtId: c.courtId, reason: "alreadyExists" });
      continue;
    }
    const did = courtDid(input.jurisdiction, c.courtId);
    const record: CourtRecord = {
      did,
      jurisdiction: input.jurisdiction.toLowerCase(),
      courtId: c.courtId,
      name: c.name,
      nameLocal: c.nameLocal,
      tier: c.tier,
      role: c.role,
      searchPath: c.searchPath,
      createdAt: new Date().toISOString(),
    };
    const receipt = await e.write({
      collection: COURT_COLLECTION,
      record: record as unknown as Record<string, unknown>,
      rkey,
    });
    registered.push({ courtId: c.courtId, courtUri: receipt.uri, did });
  }

  return {
    status: "ok",
    jurisdiction: input.jurisdiction.toLowerCase(),
    registered,
    skipped,
  };
}

/**
 * List courts, optionally filtered by jurisdiction. Phase 2 post-fetch
 * filter; Phase 3 mst-projector indexed view.
 */
export async function listCourts(
  e: Etzhayyim,
  input: ListCourtsInput = {}
): Promise<ListCourtsOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<CourtRecord>({
    collection: COURT_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: CourtView[] = resp.records
    .filter((r) =>
      input.jurisdiction
        ? r.value.jurisdiction === input.jurisdiction.toLowerCase()
        : true
    )
    .filter((r) => (input.tier ? r.value.tier === input.tier : true))
    .map((r) => ({ ...r.value, courtUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

/**
 * Collect court entities from Wikidata. Phase 2 stub — actual SPARQL
 * query happens in LangServer pod, response normalized to court
 * records here. Returns counters only.
 */
export function collectWikidataCourts(
  input: CollectWikidataCourtsInput
): CollectWikidataCourtsOutput {
  return {
    status: "ok",
    schema: "com.etzhayyim.hanrei.collect.v1",
    source: "wikidata",
    sparqlEndpoint: "https://query.wikidata.org/sparql",
    jurisdiction: input.jurisdiction,
    collected: 0,
    inserted: 0,
    skipped: 0,
    collectedAt: new Date().toISOString(),
  };
}
