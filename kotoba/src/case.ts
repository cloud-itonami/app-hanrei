/**
 * hanrei kotoba — case tier (slice 3, +4 → 10/31).
 *
 *   seedCases    — bulk insert case records (idempotent rkey=caseId)
 *   getCase      — rkey-direct read
 *   listCases    — cursor + post-fetch filter
 *   searchCases  — Phase 2 client-side text matching; Phase 3 IVF
 *
 * Court records → case records relationship via court.did.
 *
 * Phase 2 stub for searchCases (real semantic search = LangServer
 * pod + mst-projector + embedding index per Phase 3).
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  HANREI_DID_PREFIX,
  type CaseRecord,
  type CaseView,
  type GetCaseInput,
  type GetCaseOutput,
  type ListCasesInput,
  type ListCasesOutput,
  type SearchCasesInput,
  type SearchCasesOutput,
  type SeedCasesInput,
  type SeedCasesOutput,
} from "./types.js";

const CASE_COLLECTION = "com.etzhayyim.hanrei.case";

function caseDid(caseId: string): string {
  return `${HANREI_DID_PREFIX}case:${caseId.toLowerCase()}`;
}

function caseRkey(caseId: string): string {
  return `case-${caseId.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

/**
 * Bulk seed case records. Idempotent: per-case rkey based on caseId.
 */
export async function seedCases(
  e: Etzhayyim,
  input: SeedCasesInput
): Promise<SeedCasesOutput> {
  if (!input.cases || input.cases.length === 0) {
    return { status: "rejected", error: "missingCases" };
  }
  const inserted: { caseId: string; caseUri: string }[] = [];
  const skipped: { caseId: string; reason: string }[] = [];

  for (const c of input.cases) {
    if (!c.caseId || !c.title) {
      skipped.push({ caseId: c.caseId ?? "", reason: "missingFields" });
      continue;
    }
    const rkey = caseRkey(c.caseId);
    const existing = await e
      .read<CaseRecord>({ collection: CASE_COLLECTION, rkey })
      .catch(() => ({ records: [] }));
    if (existing.records[0]?.value) {
      skipped.push({ caseId: c.caseId, reason: "alreadyExists" });
      continue;
    }
    const record: CaseRecord = {
      did: caseDid(c.caseId),
      caseId: c.caseId,
      title: c.title,
      courtDid: c.courtDid,
      jurisdiction: c.jurisdiction?.toUpperCase(),
      decidedAt: c.decidedAt,
      caseNumber: c.caseNumber,
      summary: c.summary,
      tags: c.tags,
      sourceUrl: c.sourceUrl,
      createdAt: new Date().toISOString(),
    };
    const receipt = await e.write({
      collection: CASE_COLLECTION,
      record: record as unknown as Record<string, unknown>,
      rkey,
    });
    inserted.push({ caseId: c.caseId, caseUri: receipt.uri });
  }

  return { status: "ok", inserted, skipped };
}

export async function getCase(
  e: Etzhayyim,
  input: GetCaseInput
): Promise<GetCaseOutput> {
  if (!input.caseId) return { error: "missingCaseId" };
  const resp = await e
    .read<CaseRecord>({
      collection: CASE_COLLECTION,
      rkey: caseRkey(input.caseId),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  return { case: { ...r.value, caseUri: r.uri } };
}

export async function listCases(
  e: Etzhayyim,
  input: ListCasesInput = {}
): Promise<ListCasesOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<CaseRecord>({
    collection: CASE_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: CaseView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.courtDid && v.courtDid !== input.courtDid) return false;
      if (input.jurisdiction && v.jurisdiction !== input.jurisdiction.toUpperCase()) return false;
      return true;
    })
    .map((r) => ({ ...r.value, caseUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

/**
 * Phase 2 client-side text search. Phase 3 → mst-projector + IVF
 * embedding index for semantic search.
 */
export async function searchCases(
  e: Etzhayyim,
  input: SearchCasesInput
): Promise<SearchCasesOutput> {
  if (!input.query) return { items: [], total: 0 };
  const limit = Math.min(input.limit ?? 20, 50);
  const resp = await e.read<CaseRecord>({
    collection: CASE_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const q = input.query.toLowerCase();
  const items: CaseView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.courtDid && v.courtDid !== input.courtDid) return false;
      const hay = [v.title, v.summary, v.caseNumber, v.caseId]
        .filter((s): s is string => !!s)
        .map((s) => s.toLowerCase());
      return hay.some((h) => h.includes(q));
    })
    .map((r) => ({ ...r.value, caseUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}
