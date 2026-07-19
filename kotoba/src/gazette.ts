/**
 * hanrei kotoba — gazette tier (slice 6, +3 → 19/31).
 *
 *   registerGazetteEntry — official gazette item write (Japanese 官報,
 *                          government court orders, ministerial notices)
 *   getGazetteEntry      — rkey-direct read
 *   listGazetteEntries   — cursor + jurisdiction/issuedAt range filter
 *
 * Entries reference parent source via sourceDid (slice 5 source tier).
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  HANREI_DID_PREFIX,
  type GazetteEntryRecord,
  type GazetteEntryView,
  type GetGazetteEntryInput,
  type GetGazetteEntryOutput,
  type ListGazetteEntriesInput,
  type ListGazetteEntriesOutput,
  type RegisterGazetteEntryInput,
  type RegisterGazetteEntryOutput,
} from "./types.js";

const GAZETTE_COLLECTION = "com.etzhayyim.hanrei.gazetteEntry";

function gazetteSlug(entryId: string): string {
  return entryId.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function gazetteDid(entryId: string): string {
  return `${HANREI_DID_PREFIX}gazette:${gazetteSlug(entryId)}`;
}

function gazetteRkey(entryId: string): string {
  return `gazette-${gazetteSlug(entryId)}`;
}

export async function registerGazetteEntry(
  e: Etzhayyim,
  input: RegisterGazetteEntryInput
): Promise<RegisterGazetteEntryOutput> {
  if (!input.entryId || !input.title) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = gazetteRkey(input.entryId);
  const existing = await e
    .read<GazetteEntryRecord>({ collection: GAZETTE_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      gazetteUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      entryId: input.entryId,
    };
  }
  const did = gazetteDid(input.entryId);
  const record: GazetteEntryRecord = {
    did,
    entryId: input.entryId,
    title: input.title,
    titleLocal: input.titleLocal,
    jurisdiction: input.jurisdiction?.toLowerCase(),
    issuedAt: input.issuedAt,
    issueNumber: input.issueNumber,
    category: input.category,
    sourceDid: input.sourceDid,
    sourceUrl: input.sourceUrl,
    summary: input.summary,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: GAZETTE_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    gazetteUri: receipt.uri,
    did,
    entryId: input.entryId,
  };
}

export async function getGazetteEntry(
  e: Etzhayyim,
  input: GetGazetteEntryInput
): Promise<GetGazetteEntryOutput> {
  if (!input.entryId) return { error: "missingEntryId" };
  const resp = await e
    .read<GazetteEntryRecord>({
      collection: GAZETTE_COLLECTION,
      rkey: gazetteRkey(input.entryId),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: GazetteEntryView = { ...r.value, gazetteUri: r.uri };
  return { gazetteEntry: view };
}

export async function listGazetteEntries(
  e: Etzhayyim,
  input: ListGazetteEntriesInput = {}
): Promise<ListGazetteEntriesOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<GazetteEntryRecord>({
    collection: GAZETTE_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: GazetteEntryView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (
        input.jurisdiction &&
        v.jurisdiction !== input.jurisdiction.toLowerCase()
      ) {
        return false;
      }
      if (input.category && v.category !== input.category) return false;
      if (input.sourceDid && v.sourceDid !== input.sourceDid) return false;
      if (input.issuedAfter && (!v.issuedAt || v.issuedAt < input.issuedAfter)) {
        return false;
      }
      if (
        input.issuedBefore &&
        (!v.issuedAt || v.issuedAt > input.issuedBefore)
      ) {
        return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, gazetteUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}
