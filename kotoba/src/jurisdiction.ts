/**
 * hanrei kotoba — jurisdiction registry (Option B reference).
 *
 * Per ADR-2605203000 Phase E Option B: replace vendor's
 *   createKyselyDb().insertInto("vertex_hanrei_jurisdiction")
 * with:
 *   e.write({ collection, record, rkey })
 *
 * Vendor reference: `60-apps/etzhayyim-project-hanrei/appview/
 *   etzhayyim-wasm-hanrei-jp-h4nr31jp/src/app.ts` (cmdGetJurisdiction +
 *   cmdListJurisdictions + cmdRegisterJurisdictions stubs).
 *
 * Scope: 3 reference commands of 31 total in vendor.
 *   - registerJurisdiction  — write (idempotent rkey=jurisdiction-{iso3})
 *   - getJurisdiction       — read (rkey-direct)
 *   - listJurisdictions     — list with cursor + post-fetch filter
 *
 * Remaining 28 commands (court / case / legislation / gazette / etc.)
 * follow same Option B pattern; subsequent wave-3 slices port them.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  jurisdictionDid,
  jurisdictionRkey,
  type GetJurisdictionInput,
  type GetJurisdictionOutput,
  type JurisdictionRecord,
  type JurisdictionView,
  type ListJurisdictionsInput,
  type ListJurisdictionsOutput,
  type RegisterJurisdictionInput,
  type RegisterJurisdictionOutput,
} from "./types.js";

const JURISDICTION_COLLECTION = "com.etzhayyim.hanrei.jurisdiction";

/**
 * Register a jurisdiction. Uses rkey = "jurisdiction-{iso3}" so re-
 * registration with the same code returns alreadyExists.
 */
export async function registerJurisdiction(
  e: Etzhayyim,
  input: RegisterJurisdictionInput
): Promise<RegisterJurisdictionOutput> {
  if (!input.iso3 || !input.name) {
    return {
      status: "rejected",
      error: "missingRequiredFields",
    };
  }
  if (input.iso3.length !== 3) {
    return {
      status: "rejected",
      error: "iso3MustBe3Chars",
    };
  }

  // rkey is normalized (uppercase) for lookup parity; record preserves original input case.
  const rkeyIso = input.iso3.toUpperCase();
  const iso3 = input.iso3;
  const rkey = jurisdictionRkey(rkeyIso);

  const existing = await e
    .read<JurisdictionRecord>({
      collection: JURISDICTION_COLLECTION,
      rkey,
    })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      jurisdictionUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      iso3: existing.records[0].value.iso3,
    };
  }

  const did = jurisdictionDid(rkeyIso);
  const record: JurisdictionRecord = {
    did,
    iso3,
    name: input.name,
    nameLocal: input.nameLocal,
    legalSystem: input.legalSystem,
    courts: input.courts,
    primaryLanguage: input.primaryLanguage,
    caseLawSource: input.caseLawSource,
    createdAt: new Date().toISOString(),
  };

  const receipt = await e.write({
    collection: JURISDICTION_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });

  return {
    status: "registered",
    jurisdictionUri: receipt.uri,
    did,
    iso3,
  };
}

/** Look up a jurisdiction by ISO 3166 alpha-3 code. */
export async function getJurisdiction(
  e: Etzhayyim,
  input: GetJurisdictionInput
): Promise<GetJurisdictionOutput> {
  if (!input.iso3 || input.iso3.length !== 3) {
    return { error: "invalidIso3" };
  }
  const resp = await e
    .read<JurisdictionRecord>({
      collection: JURISDICTION_COLLECTION,
      rkey: jurisdictionRkey(input.iso3.toUpperCase()),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { jurisdiction: { ...r.value, jurisdictionUri: r.uri } };
}

/**
 * List jurisdictions with cursor pagination + post-fetch filter on
 * legalSystem. Phase 3 mst-projector will move legalSystem filter
 * into an indexed view (~200 jurisdictions total; small enough to
 * full-scan in Phase 2).
 */
export async function listJurisdictions(
  e: Etzhayyim,
  input: ListJurisdictionsInput = {}
): Promise<ListJurisdictionsOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<JurisdictionRecord>({
    collection: JURISDICTION_COLLECTION,
    cursor: input.cursor,
    limit,
  });

  const items: JurisdictionView[] = resp.records
    .filter((r) =>
      input.legalSystem ? r.value.legalSystem === input.legalSystem : true
    )
    .map((r) => ({ ...r.value, jurisdictionUri: r.uri }));

  return {
    items,
    cursor: resp.cursor,
    total: items.length,
  };
}
