/**
 * hanrei kotoba — source tier (slice 5, +3 → 16/31).
 *
 *   registerSource — upstream legal data provider write
 *                    (court website / e-Gov / official gazette / scholarly corpus)
 *   getSource      — rkey-direct read
 *   listSources    — cursor + jurisdiction/kind filter
 *
 * Sources feed the collect* command family — registered first so
 * collect* commands can attach sourceDid for provenance.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  HANREI_DID_PREFIX,
  type GetSourceInput,
  type GetSourceOutput,
  type ListSourcesInput,
  type ListSourcesOutput,
  type RegisterSourceInput,
  type RegisterSourceOutput,
  type SourceRecord,
  type SourceView,
} from "./types.js";

const SOURCE_COLLECTION = "com.etzhayyim.hanrei.source";

function sourceSlug(sourceId: string): string {
  return sourceId.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function sourceDid(sourceId: string): string {
  return `${HANREI_DID_PREFIX}source:${sourceSlug(sourceId)}`;
}

function sourceRkey(sourceId: string): string {
  return `source-${sourceSlug(sourceId)}`;
}

export async function registerSource(
  e: Etzhayyim,
  input: RegisterSourceInput
): Promise<RegisterSourceOutput> {
  if (!input.sourceId || !input.name) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = sourceRkey(input.sourceId);
  const existing = await e
    .read<SourceRecord>({ collection: SOURCE_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      sourceUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      sourceId: input.sourceId,
    };
  }
  const did = sourceDid(input.sourceId);
  const record: SourceRecord = {
    did,
    sourceId: input.sourceId,
    name: input.name,
    kind: input.kind,
    jurisdiction: input.jurisdiction?.toLowerCase(),
    homepage: input.homepage,
    apiBase: input.apiBase,
    license: input.license,
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: SOURCE_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    sourceUri: receipt.uri,
    did,
    sourceId: input.sourceId,
  };
}

export async function getSource(
  e: Etzhayyim,
  input: GetSourceInput
): Promise<GetSourceOutput> {
  if (!input.sourceId) return { error: "missingSourceId" };
  const resp = await e
    .read<SourceRecord>({
      collection: SOURCE_COLLECTION,
      rkey: sourceRkey(input.sourceId),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: SourceView = { ...r.value, sourceUri: r.uri };
  return { source: view };
}

export async function listSources(
  e: Etzhayyim,
  input: ListSourcesInput = {}
): Promise<ListSourcesOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<SourceRecord>({
    collection: SOURCE_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: SourceView[] = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.kind && v.kind !== input.kind) return false;
      if (
        input.jurisdiction &&
        v.jurisdiction !== input.jurisdiction.toLowerCase()
      ) {
        return false;
      }
      return true;
    })
    .map((r) => ({ ...r.value, sourceUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}
