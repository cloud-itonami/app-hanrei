/**
 * hanrei kotoba — law tier (slice 4, +3 → 13/31).
 *
 *   registerLaw  — Japanese / international legislation record write
 *                  (idempotent rkey=law-{lawId-slug})
 *   getLaw       — rkey-direct read
 *   listLaws     — cursor + post-fetch filter (jurisdiction / status)
 *
 * Laws are referenced by case records (CaseRecord.tags / summary).
 * Phase 3 mst-projector adds law ↔ case backref index.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  HANREI_DID_PREFIX,
  type GetLawInput,
  type GetLawOutput,
  type LawRecord,
  type LawView,
  type ListLawsInput,
  type ListLawsOutput,
  type RegisterLawInput,
  type RegisterLawOutput,
} from "./types.js";

const LAW_COLLECTION = "com.etzhayyim.hanrei.law";

function lawSlug(lawId: string): string {
  return lawId.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function lawDid(lawId: string): string {
  return `${HANREI_DID_PREFIX}law:${lawSlug(lawId)}`;
}

function lawRkey(lawId: string): string {
  return `law-${lawSlug(lawId)}`;
}

export async function registerLaw(
  e: Etzhayyim,
  input: RegisterLawInput
): Promise<RegisterLawOutput> {
  if (!input.lawId || !input.title) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = lawRkey(input.lawId);
  const existing = await e
    .read<LawRecord>({ collection: LAW_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      lawUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      lawId: input.lawId,
    };
  }
  const did = lawDid(input.lawId);
  const record: LawRecord = {
    did,
    lawId: input.lawId,
    title: input.title,
    titleLocal: input.titleLocal,
    jurisdiction: input.jurisdiction?.toLowerCase(),
    enactedAt: input.enactedAt,
    effectiveAt: input.effectiveAt,
    repealedAt: input.repealedAt,
    status: input.status,
    sourceUrl: input.sourceUrl,
    tags: input.tags,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: LAW_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    lawUri: receipt.uri,
    did,
    lawId: input.lawId,
  };
}

export async function getLaw(
  e: Etzhayyim,
  input: GetLawInput
): Promise<GetLawOutput> {
  if (!input.lawId) return { error: "missingLawId" };
  const resp = await e
    .read<LawRecord>({
      collection: LAW_COLLECTION,
      rkey: lawRkey(input.lawId),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: LawView = { ...r.value, lawUri: r.uri };
  return { law: view };
}

export async function listLaws(
  e: Etzhayyim,
  input: ListLawsInput = {}
): Promise<ListLawsOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<LawRecord>({
    collection: LAW_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: LawView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (
        input.jurisdiction &&
        v.jurisdiction !== input.jurisdiction.toLowerCase()
      ) {
        return false;
      }
      if (input.status && v.status !== input.status) return false;
      return true;
    })
    .map((r) => ({ ...r.value, lawUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}
