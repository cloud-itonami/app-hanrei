/**
 * hanrei kotoba — collect tier (slice 10, +4 → 31/31, 100%).
 *
 *   searchDecisions     — text + holding/citedLaw match across cases
 *                         (Phase 2 client-side; Phase 3 → IVF embedding)
 *   extractCasePersons  — LLM-extracted person list stub
 *                         (Phase 2 = client-supplied; Phase 3 = LangServer pod)
 *   collectCases        — orchestration wrapper writing N cases + parent CollectRun
 *   collectCaseDetail   — orchestration wrapper writing 1 case + Digest update
 *
 * The collect* commands are orchestration helpers — they wrap external
 * upstream fetches (court website scrape / e-Gov API / etc.) into a single
 * idempotent write pass. The "fetch" itself happens server-side in the
 * LangServer pod (per ADR-2605111200); these functions just take the
 * already-fetched payload and persist it via existing PDS writes
 * (seedCases / registerCase / registerDigest).
 *
 * A CollectRun record per collect call provides provenance + retry
 * idempotency. rkey=collectRun-{runId-slug}.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import { registerDigest } from "./digest.js";
import { seedCases } from "./case.js";
import {
  HANREI_DID_PREFIX,
  type CollectCaseDetailInput,
  type CollectCaseDetailOutput,
  type CollectCasesInput,
  type CollectCasesOutput,
  type CollectRunRecord,
  type ExtractCasePersonsInput,
  type ExtractCasePersonsOutput,
  type ExtractedPerson,
  type SearchDecisionsInput,
  type SearchDecisionsOutput,
  type CaseRecord,
} from "./types.js";

const CASE_COLLECTION = "com.etzhayyim.hanrei.case";
const COLLECT_RUN_COLLECTION = "com.etzhayyim.hanrei.collectRun";

function collectRunSlug(runId: string): string {
  return runId.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function collectRunRkey(runId: string): string {
  return `collectRun-${collectRunSlug(runId)}`;
}

function collectRunDid(runId: string): string {
  return `${HANREI_DID_PREFIX}collectRun:${collectRunSlug(runId)}`;
}

async function writeCollectRun(
  e: Etzhayyim,
  runId: string,
  kind: CollectRunRecord["kind"],
  jurisdiction: string | undefined,
  sourceDid: string | undefined,
  itemsCount: number,
  status: CollectRunRecord["status"]
) {
  const rkey = collectRunRkey(runId);
  const existing = await e
    .read<CollectRunRecord>({ collection: COLLECT_RUN_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return { runUri: existing.records[0].uri, alreadyExists: true };
  }
  const record: CollectRunRecord = {
    did: collectRunDid(runId),
    runId,
    kind,
    jurisdiction: jurisdiction?.toLowerCase(),
    sourceDid,
    itemsCount,
    status,
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: COLLECT_RUN_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return { runUri: receipt.uri, alreadyExists: false };
}

export async function searchDecisions(
  e: Etzhayyim,
  input: SearchDecisionsInput
): Promise<SearchDecisionsOutput> {
  if (!input.query) return { items: [], total: 0 };
  const limit = Math.min(input.limit ?? 20, 50);
  const resp = await e.read<CaseRecord>({
    collection: CASE_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const q = input.query.toLowerCase();
  const items = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.courtDid && v.courtDid !== input.courtDid) return false;
      if (
        input.jurisdiction &&
        v.jurisdiction !== input.jurisdiction.toLowerCase()
      ) {
        return false;
      }
      const hay = [v.title, v.summary, v.caseNumber, v.caseId]
        .filter((s): s is string => !!s)
        .map((s) => s.toLowerCase());
      const tagHay = (v.tags ?? []).map((s) => s.toLowerCase());
      return hay.some((h) => h.includes(q)) || tagHay.some((h) => h === q);
    })
    .map((r) => ({ ...r.value, caseUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}

export async function extractCasePersons(
  e: Etzhayyim,
  input: ExtractCasePersonsInput
): Promise<ExtractCasePersonsOutput> {
  if (!input.caseId) return { error: "missingCaseId" };
  if (!input.persons || input.persons.length === 0) {
    return { error: "missingPersons" };
  }
  // Phase 2: client-supplied (e.g. from a LangServer pod). Phase 3 wires
  // a real extraction pipeline — for now we just persist the supplied
  // list as a digest entry under a synthetic model name.
  const synthSummary = input.persons
    .map((p: ExtractedPerson) => `${p.role}: ${p.name}`)
    .join("; ");
  const digestRes = await registerDigest(e, {
    caseId: input.caseId,
    model: input.model ?? "person-extract-v0",
    summary: `Person extract — ${input.persons.length} people`,
    keypoints: input.persons.map((p) => `${p.role}:${p.name}`),
    language: input.language,
    generatedAt: new Date().toISOString(),
  });
  return {
    caseId: input.caseId,
    extracted: input.persons.length,
    digestUri: digestRes.digestUri,
    summary: synthSummary,
  };
}

export async function collectCases(
  e: Etzhayyim,
  input: CollectCasesInput
): Promise<CollectCasesOutput> {
  if (!input.runId || !input.cases || input.cases.length === 0) {
    return { error: "missingRequiredFields" };
  }
  const seedRes = await seedCases(e, { cases: input.cases });
  const run = await writeCollectRun(
    e,
    input.runId,
    "cases",
    input.jurisdiction,
    input.sourceDid,
    seedRes.inserted?.length ?? 0,
    seedRes.status === "ok" ? "completed" : "failed"
  );
  return {
    runId: input.runId,
    runUri: run.runUri,
    inserted: seedRes.inserted ?? [],
    skipped: seedRes.skipped ?? [],
    alreadyExists: run.alreadyExists,
  };
}

export async function collectCaseDetail(
  e: Etzhayyim,
  input: CollectCaseDetailInput
): Promise<CollectCaseDetailOutput> {
  if (!input.caseId || !input.title) {
    return { error: "missingRequiredFields" };
  }
  const seedRes = await seedCases(e, {
    cases: [
      {
        caseId: input.caseId,
        title: input.title,
        courtDid: input.courtDid,
        jurisdiction: input.jurisdiction,
        decidedAt: input.decidedAt,
        caseNumber: input.caseNumber,
        summary: input.summary,
        tags: input.tags,
        sourceUrl: input.sourceUrl,
      },
    ],
  });

  let digestUri: string | undefined;
  if (input.digestSummary && input.digestModel) {
    const dig = await registerDigest(e, {
      caseId: input.caseId,
      model: input.digestModel,
      summary: input.digestSummary,
      keypoints: input.digestKeypoints,
      holdings: input.digestHoldings,
      citedLaws: input.digestCitedLaws,
      language: input.digestLanguage,
      generatedAt: new Date().toISOString(),
    });
    digestUri = dig.digestUri;
  }

  return {
    caseId: input.caseId,
    caseUri: seedRes.inserted?.[0]?.caseUri,
    digestUri,
    skipped: (seedRes.skipped?.length ?? 0) > 0,
  };
}
