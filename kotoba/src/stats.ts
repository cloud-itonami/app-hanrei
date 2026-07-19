/**
 * hanrei kotoba — stats tier (slice 9, +3 → 27/31).
 *
 *   coverageStats        — count cases/laws/gazette per jurisdiction
 *   huntCoverageStats    — count hunt results per hunt
 *   compareJurisdictions — side-by-side counts for N jurisdictions
 *
 * Pure read-side aggregation — no new collection. Phase 3 mst-projector
 * pushes these counts to indexed materialized views so the in-process
 * scan-and-count pattern can be replaced by O(1) reads.
 *
 * Until then: full collection scans up to maxScan cap (default 10000).
 * Returns scannedCount in response so callers can detect truncation.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  type CaseRecord,
  type CompareJurisdictionsInput,
  type CompareJurisdictionsOutput,
  type CoverageStatsInput,
  type CoverageStatsOutput,
  type GazetteEntryRecord,
  type HuntCoverageStatsInput,
  type HuntCoverageStatsOutput,
  type HuntResultRecord,
  type JurisdictionCoverage,
  type LawRecord,
} from "./types.js";

const CASE_COLLECTION = "com.etzhayyim.hanrei.case";
const LAW_COLLECTION = "com.etzhayyim.hanrei.law";
const GAZETTE_COLLECTION = "com.etzhayyim.hanrei.gazetteEntry";
const HUNT_RESULT_COLLECTION = "com.etzhayyim.hanrei.huntResult";

const DEFAULT_MAX_SCAN = 10_000;
const PAGE_LIMIT = 100;

async function scanCollection<T>(
  e: Etzhayyim,
  collection: string,
  maxScan: number
): Promise<{ records: { value: T }[]; truncated: boolean }> {
  const out: { value: T }[] = [];
  let cursor: string | undefined;
  let scanned = 0;
  while (scanned < maxScan) {
    const page = await e.read<T>({ collection, cursor, limit: PAGE_LIMIT });
    for (const r of page.records) out.push({ value: r.value });
    scanned += page.records.length;
    if (!page.cursor || page.records.length < PAGE_LIMIT) break;
    cursor = page.cursor;
  }
  return { records: out, truncated: scanned >= maxScan };
}

async function jurisdictionCoverage(
  e: Etzhayyim,
  jurisdiction: string,
  maxScan: number
): Promise<JurisdictionCoverage> {
  const j = jurisdiction.toLowerCase();
  const [caseScan, lawScan, gazetteScan] = await Promise.all([
    scanCollection<CaseRecord>(e, CASE_COLLECTION, maxScan),
    scanCollection<LawRecord>(e, LAW_COLLECTION, maxScan),
    scanCollection<GazetteEntryRecord>(e, GAZETTE_COLLECTION, maxScan),
  ]);
  const caseCount = caseScan.records.filter(
    (r) => r.value.jurisdiction === j
  ).length;
  const lawCount = lawScan.records.filter(
    (r) => r.value.jurisdiction === j
  ).length;
  const gazetteCount = gazetteScan.records.filter(
    (r) => r.value.jurisdiction === j
  ).length;
  return {
    jurisdiction: j,
    caseCount,
    lawCount,
    gazetteCount,
    truncated:
      caseScan.truncated || lawScan.truncated || gazetteScan.truncated,
  };
}

export async function coverageStats(
  e: Etzhayyim,
  input: CoverageStatsInput
): Promise<CoverageStatsOutput> {
  if (!input.jurisdiction) return { error: "missingJurisdiction" };
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  const coverage = await jurisdictionCoverage(e, input.jurisdiction, maxScan);
  return { coverage };
}

export async function huntCoverageStats(
  e: Etzhayyim,
  input: HuntCoverageStatsInput
): Promise<HuntCoverageStatsOutput> {
  if (!input.huntId) return { error: "missingHuntId" };
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  const scan = await scanCollection<HuntResultRecord>(
    e,
    HUNT_RESULT_COLLECTION,
    maxScan
  );
  const results = scan.records.filter((r) => r.value.huntId === input.huntId);
  const total = results.length;
  const byKind: Record<string, number> = {};
  for (const r of results) {
    byKind[r.value.kind] = (byKind[r.value.kind] ?? 0) + 1;
  }
  return {
    huntId: input.huntId,
    total,
    byKind,
    truncated: scan.truncated,
  };
}

export async function compareJurisdictions(
  e: Etzhayyim,
  input: CompareJurisdictionsInput
): Promise<CompareJurisdictionsOutput> {
  if (!input.jurisdictions || input.jurisdictions.length === 0) {
    return { error: "missingJurisdictions" };
  }
  const maxScan = Math.min(input.maxScan ?? DEFAULT_MAX_SCAN, DEFAULT_MAX_SCAN);
  const coverages = await Promise.all(
    input.jurisdictions.map((j) => jurisdictionCoverage(e, j, maxScan))
  );
  return { coverages };
}
