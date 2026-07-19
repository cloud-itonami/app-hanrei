/**
 * hanrei kotoba — record types.
 *
 * Japanese case-law corpus. Per ADR-2605203000 Option B (PDS XRPC).
 * Replaces vendor's vertex_hanrei_jurisdiction / vertex_hanrei_court /
 * vertex_hanrei_case_record with AT PDS records.
 *
 * Identity hierarchy (per hanrei CLAUDE.md):
 *   did:web:hanrei.etzhayyim.com                       — controller
 *   did:web:hanrei.etzhayyim.com:jurisdiction:{iso3}   — country / region
 *   did:web:hanrei.etzhayyim.com:court:{jurisdiction}:{courtId}
 *   did:web:hanrei.etzhayyim.com:case:{caseId}
 *   did:web:hanrei.etzhayyim.com:law:{lawId}
 */

export interface JurisdictionRecord {
  did: string;
  iso3: string;
  name: string;
  nameLocal?: string;
  legalSystem?: "civil-law" | "common-law" | "religious-law" | "mixed";
  courts?: string[];
  primaryLanguage?: string;
  caseLawSource?: string;
  createdAt: string;
}

export interface JurisdictionView extends JurisdictionRecord {
  jurisdictionUri: string;
}

export interface RegisterJurisdictionInput {
  iso3: string;
  name: string;
  nameLocal?: string;
  legalSystem?: JurisdictionRecord["legalSystem"];
  courts?: string[];
  primaryLanguage?: string;
  caseLawSource?: string;
}

export interface RegisterJurisdictionOutput {
  status: "registered" | "alreadyExists" | "rejected";
  jurisdictionUri?: string;
  did?: string;
  iso3?: string;
  error?: string;
}

export interface GetJurisdictionInput {
  iso3: string;
}

export interface GetJurisdictionOutput {
  jurisdiction?: JurisdictionView;
  error?: string;
}

export interface ListJurisdictionsInput {
  legalSystem?: JurisdictionRecord["legalSystem"];
  limit?: number;
  cursor?: string;
}

export interface ListJurisdictionsOutput {
  items: JurisdictionView[];
  cursor?: string;
  total: number;
}

export const HANREI_DID_PREFIX = "did:web:hanrei.etzhayyim.com:" as const;

export function jurisdictionDid(iso3: string): string {
  return `${HANREI_DID_PREFIX}jurisdiction:${iso3.toLowerCase()}`;
}

export function jurisdictionRkey(iso3: string): string {
  return `jurisdiction-${iso3.toLowerCase()}`;
}

// ─── Court tier (slice 2) ───────────────────────────────────────────

export type CourtTier =
  | "supreme"
  | "high"
  | "ip-high"
  | "district"
  | "family"
  | "summary";

export interface CourtRecord {
  did: string;
  jurisdiction: string;
  courtId: string;
  name: string;
  nameLocal?: string;
  tier?: CourtTier;
  role?: string;
  searchPath?: string;
  createdAt: string;
}

export interface CourtView extends CourtRecord {
  courtUri: string;
}

export interface CourtProfileInput {
  courtId: string;
  name: string;
  nameLocal?: string;
  tier?: CourtTier;
  role?: string;
  searchPath?: string;
}

export interface RegisterCourtProfilesInput {
  jurisdiction: string;
  courts: CourtProfileInput[];
}

export interface RegisterCourtProfilesOutput {
  status: "ok" | "rejected";
  jurisdiction?: string;
  registered?: { courtId: string; courtUri: string; did: string }[];
  skipped?: { courtId: string; reason: string }[];
  error?: string;
}

export interface ListCourtsInput {
  jurisdiction?: string;
  tier?: CourtTier;
  limit?: number;
  cursor?: string;
}

export interface ListCourtsOutput {
  items: CourtView[];
  cursor?: string;
  total: number;
}

export interface CollectWikidataCourtsInput {
  jurisdiction?: string;
}

export interface CollectWikidataCourtsOutput {
  status: "ok";
  schema: string;
  source: string;
  sparqlEndpoint: string;
  jurisdiction?: string;
  collected: number;
  inserted: number;
  skipped: number;
  collectedAt: string;
}

// ─── Case tier (slice 3) ────────────────────────────────────────────

export interface CaseRecord {
  did: string;
  caseId: string;
  title: string;
  courtDid?: string;
  jurisdiction?: string;
  decidedAt?: string;
  caseNumber?: string;
  summary?: string;
  tags?: string[];
  sourceUrl?: string;
  createdAt: string;
}

export interface CaseView extends CaseRecord {
  caseUri: string;
}

export interface CaseSeedInput {
  caseId: string;
  title: string;
  courtDid?: string;
  jurisdiction?: string;
  decidedAt?: string;
  caseNumber?: string;
  summary?: string;
  tags?: string[];
  sourceUrl?: string;
}

export interface SeedCasesInput {
  cases: CaseSeedInput[];
}

export interface SeedCasesOutput {
  status: "ok" | "rejected";
  inserted?: { caseId: string; caseUri: string }[];
  skipped?: { caseId: string; reason: string }[];
  error?: string;
}

export interface GetCaseInput {
  caseId?: string;
}

export interface GetCaseOutput {
  case?: CaseView;
  error?: string;
}

export interface ListCasesInput {
  courtDid?: string;
  jurisdiction?: string;
  limit?: number;
  cursor?: string;
}

export interface ListCasesOutput {
  items: CaseView[];
  cursor?: string;
  total: number;
}

export interface SearchCasesInput {
  query: string;
  courtDid?: string;
  limit?: number;
  cursor?: string;
}

export type SearchCasesOutput = ListCasesOutput;

// ─── Law tier (slice 4) ─────────────────────────────────────────────

export type LawStatus = "in-force" | "amended" | "repealed" | "proposed";

export interface LawRecord {
  did: string;
  lawId: string;
  title: string;
  titleLocal?: string;
  jurisdiction?: string;
  enactedAt?: string;
  effectiveAt?: string;
  repealedAt?: string;
  status?: LawStatus;
  sourceUrl?: string;
  tags?: string[];
  createdAt: string;
}

export interface LawView extends LawRecord {
  lawUri: string;
}

export interface RegisterLawInput {
  lawId: string;
  title: string;
  titleLocal?: string;
  jurisdiction?: string;
  enactedAt?: string;
  effectiveAt?: string;
  repealedAt?: string;
  status?: LawStatus;
  sourceUrl?: string;
  tags?: string[];
}

export interface RegisterLawOutput {
  status: "registered" | "alreadyExists" | "rejected";
  lawUri?: string;
  did?: string;
  lawId?: string;
  error?: string;
}

export interface GetLawInput {
  lawId?: string;
}

export interface GetLawOutput {
  law?: LawView;
  error?: string;
}

export interface ListLawsInput {
  jurisdiction?: string;
  status?: LawStatus;
  limit?: number;
  cursor?: string;
}

export interface ListLawsOutput {
  items: LawView[];
  cursor?: string;
  total: number;
}

// ─── Source tier (slice 5) ──────────────────────────────────────────

export type SourceKind =
  | "court-website"
  | "egov-portal"
  | "official-gazette"
  | "scholarly"
  | "commercial"
  | "wikidata"
  | "other";

export interface SourceRecord {
  did: string;
  sourceId: string;
  name: string;
  kind?: SourceKind;
  jurisdiction?: string;
  homepage?: string;
  apiBase?: string;
  license?: string;
  createdAt: string;
}

export interface SourceView extends SourceRecord {
  sourceUri: string;
}

export interface RegisterSourceInput {
  sourceId: string;
  name: string;
  kind?: SourceKind;
  jurisdiction?: string;
  homepage?: string;
  apiBase?: string;
  license?: string;
}

export interface RegisterSourceOutput {
  status: "registered" | "alreadyExists" | "rejected";
  sourceUri?: string;
  did?: string;
  sourceId?: string;
  error?: string;
}

export interface GetSourceInput {
  sourceId?: string;
}

export interface GetSourceOutput {
  source?: SourceView;
  error?: string;
}

export interface ListSourcesInput {
  kind?: SourceKind;
  jurisdiction?: string;
  limit?: number;
  cursor?: string;
}

export interface ListSourcesOutput {
  items: SourceView[];
  cursor?: string;
  total: number;
}

// ─── Gazette tier (slice 6) ─────────────────────────────────────────

export type GazetteCategory =
  | "court-order"
  | "ministerial-notice"
  | "legislation"
  | "commercial-registration"
  | "bankruptcy"
  | "other";

export interface GazetteEntryRecord {
  did: string;
  entryId: string;
  title: string;
  titleLocal?: string;
  jurisdiction?: string;
  issuedAt?: string;
  issueNumber?: string;
  category?: GazetteCategory;
  sourceDid?: string;
  sourceUrl?: string;
  summary?: string;
  createdAt: string;
}

export interface GazetteEntryView extends GazetteEntryRecord {
  gazetteUri: string;
}

export interface RegisterGazetteEntryInput {
  entryId: string;
  title: string;
  titleLocal?: string;
  jurisdiction?: string;
  issuedAt?: string;
  issueNumber?: string;
  category?: GazetteCategory;
  sourceDid?: string;
  sourceUrl?: string;
  summary?: string;
}

export interface RegisterGazetteEntryOutput {
  status: "registered" | "alreadyExists" | "rejected";
  gazetteUri?: string;
  did?: string;
  entryId?: string;
  error?: string;
}

export interface GetGazetteEntryInput {
  entryId?: string;
}

export interface GetGazetteEntryOutput {
  gazetteEntry?: GazetteEntryView;
  error?: string;
}

export interface ListGazetteEntriesInput {
  jurisdiction?: string;
  category?: GazetteCategory;
  sourceDid?: string;
  issuedAfter?: string;
  issuedBefore?: string;
  limit?: number;
  cursor?: string;
}

export interface ListGazetteEntriesOutput {
  items: GazetteEntryView[];
  cursor?: string;
  total: number;
}

// ─── Digest tier (slice 7) ──────────────────────────────────────────

export interface DigestRecord {
  did: string;
  caseId: string;
  caseDid?: string;
  /** Model identifier (e.g. claude-opus-4-7, gpt-5, llama-4-scout-17b). */
  model: string;
  summary: string;
  keypoints?: string[];
  holdings?: string[];
  citedLaws?: string[];
  language?: string;
  tokenCount?: number;
  generatedAt: string;
  createdAt: string;
}

export interface DigestView extends DigestRecord {
  digestUri: string;
}

export interface RegisterDigestInput {
  caseId: string;
  caseDid?: string;
  model: string;
  summary: string;
  keypoints?: string[];
  holdings?: string[];
  citedLaws?: string[];
  language?: string;
  tokenCount?: number;
  generatedAt?: string;
}

export interface RegisterDigestOutput {
  status: "registered" | "alreadyExists" | "rejected";
  digestUri?: string;
  did?: string;
  caseId?: string;
  model?: string;
  error?: string;
}

export interface GetDigestInput {
  caseId?: string;
  model?: string;
}

export interface GetDigestOutput {
  digest?: DigestView;
  error?: string;
}

// ─── Hunt tier (slice 8) ────────────────────────────────────────────

export type HuntStatus = "open" | "active" | "completed" | "abandoned";

export type HuntResultKind = "case" | "law" | "gazette" | "court" | "other";

export interface HuntRecord {
  did: string;
  huntId: string;
  query: string;
  jurisdiction?: string;
  operatorDid?: string;
  sourceDids?: string[];
  deadline?: string;
  status: HuntStatus;
  openedAt: string;
  createdAt: string;
}

export interface HuntView extends HuntRecord {
  huntUri: string;
}

export interface CreateInformationHuntInput {
  huntId: string;
  query: string;
  jurisdiction?: string;
  operatorDid?: string;
  sourceDids?: string[];
  deadline?: string;
}

export interface CreateInformationHuntOutput {
  status: "registered" | "alreadyExists" | "rejected";
  huntUri?: string;
  did?: string;
  huntId?: string;
  error?: string;
}

export interface HuntResultRecord {
  huntId: string;
  seq: number;
  kind: HuntResultKind;
  /** at-URI or DID pointing to the discovered record (case / law / gazette / court). */
  targetDid: string;
  sourceDid?: string;
  /** 0-1000 (per AT Lexicon no-float restriction → permille). */
  confidencePermille?: number;
  note?: string;
  receivedAt: string;
}

export interface HuntResultView extends HuntResultRecord {
  resultUri: string;
}

export interface ReceiveHuntResultInput {
  huntId: string;
  seq: number;
  kind: HuntResultKind;
  targetDid: string;
  sourceDid?: string;
  confidencePermille?: number;
  note?: string;
}

export interface ReceiveHuntResultOutput {
  status: "registered" | "alreadyExists" | "rejected";
  resultUri?: string;
  huntId?: string;
  seq?: number;
  error?: string;
}

export interface ListHuntResultsInput {
  huntId: string;
  kind?: HuntResultKind;
  limit?: number;
  cursor?: string;
}

export interface ListHuntResultsOutput {
  items: HuntResultView[];
  cursor?: string;
  total: number;
  error?: string;
}

// ─── Stats tier (slice 9) ───────────────────────────────────────────

export interface JurisdictionCoverage {
  jurisdiction: string;
  caseCount: number;
  lawCount: number;
  gazetteCount: number;
  truncated: boolean;
}

export interface CoverageStatsInput {
  jurisdiction?: string;
  maxScan?: number;
}

export interface CoverageStatsOutput {
  coverage?: JurisdictionCoverage;
  error?: string;
}

export interface HuntCoverageStatsInput {
  huntId?: string;
  maxScan?: number;
}

export interface HuntCoverageStatsOutput {
  huntId?: string;
  total?: number;
  byKind?: Record<string, number>;
  truncated?: boolean;
  error?: string;
}

export interface CompareJurisdictionsInput {
  jurisdictions: string[];
  maxScan?: number;
}

export interface CompareJurisdictionsOutput {
  coverages?: JurisdictionCoverage[];
  error?: string;
}

// ─── Collect tier (slice 10, final) ─────────────────────────────────

export interface SearchDecisionsInput {
  query: string;
  courtDid?: string;
  jurisdiction?: string;
  limit?: number;
  cursor?: string;
}

export type SearchDecisionsOutput = ListCasesOutput;

export interface ExtractedPerson {
  name: string;
  role: string;
  nameLocal?: string;
}

export interface ExtractCasePersonsInput {
  caseId: string;
  persons: ExtractedPerson[];
  model?: string;
  language?: string;
}

export interface ExtractCasePersonsOutput {
  caseId?: string;
  extracted?: number;
  digestUri?: string;
  summary?: string;
  error?: string;
}

export interface CollectRunRecord {
  did: string;
  runId: string;
  kind: "cases" | "case-detail" | "laws" | "gazette" | "courts";
  jurisdiction?: string;
  sourceDid?: string;
  itemsCount: number;
  status: "completed" | "partial" | "failed";
  completedAt: string;
  createdAt: string;
}

export interface CollectCasesInput {
  runId: string;
  cases: CaseSeedInput[];
  jurisdiction?: string;
  sourceDid?: string;
}

export interface CollectCasesOutput {
  runId?: string;
  runUri?: string;
  inserted?: { caseId: string; caseUri: string }[];
  skipped?: { caseId: string; reason: string }[];
  alreadyExists?: boolean;
  error?: string;
}

export interface CollectCaseDetailInput extends CaseSeedInput {
  digestModel?: string;
  digestSummary?: string;
  digestKeypoints?: string[];
  digestHoldings?: string[];
  digestCitedLaws?: string[];
  digestLanguage?: string;
}

export interface CollectCaseDetailOutput {
  caseId?: string;
  caseUri?: string;
  digestUri?: string;
  skipped?: boolean;
  error?: string;
}
