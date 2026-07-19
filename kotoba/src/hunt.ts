/**
 * hanrei kotoba — hunt tier (slice 8, +3 → 24/31).
 *
 *   createInformationHunt — open a hunt session (rkey=hunt-{huntId})
 *   receiveHuntResult     — append a result to a hunt
 *                           (rkey=hunt-result-{huntId}-{seq})
 *   listHuntResults       — cursor over results for one hunt
 *
 * A hunt is an open-ended research session — the operator posts a
 * query ("find recent supreme court rulings on AI copyright in JP")
 * and external collectors append individual case/law findings as
 * separate result records. The hunt parent record stays small;
 * results scale append-only via rkey suffix.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  HANREI_DID_PREFIX,
  type CreateInformationHuntInput,
  type CreateInformationHuntOutput,
  type HuntRecord,
  type HuntResultRecord,
  type HuntResultView,
  type ListHuntResultsInput,
  type ListHuntResultsOutput,
  type ReceiveHuntResultInput,
  type ReceiveHuntResultOutput,
} from "./types.js";

const HUNT_COLLECTION = "com.etzhayyim.hanrei.hunt";
const HUNT_RESULT_COLLECTION = "com.etzhayyim.hanrei.huntResult";

function huntSlug(huntId: string): string {
  return huntId.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function huntDid(huntId: string): string {
  return `${HANREI_DID_PREFIX}hunt:${huntSlug(huntId)}`;
}

function huntRkey(huntId: string): string {
  return `hunt-${huntSlug(huntId)}`;
}

function huntResultRkey(huntId: string, seq: number): string {
  const padded = String(seq).padStart(6, "0");
  return `hunt-result-${huntSlug(huntId)}-${padded}`;
}

export async function createInformationHunt(
  e: Etzhayyim,
  input: CreateInformationHuntInput
): Promise<CreateInformationHuntOutput> {
  if (!input.huntId || !input.query) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = huntRkey(input.huntId);
  const existing = await e
    .read<HuntRecord>({ collection: HUNT_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      huntUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      huntId: input.huntId,
    };
  }
  const did = huntDid(input.huntId);
  const record: HuntRecord = {
    did,
    huntId: input.huntId,
    query: input.query,
    jurisdiction: input.jurisdiction?.toLowerCase(),
    operatorDid: input.operatorDid,
    sourceDids: input.sourceDids,
    deadline: input.deadline,
    status: "open",
    openedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: HUNT_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    huntUri: receipt.uri,
    did,
    huntId: input.huntId,
  };
}

export async function receiveHuntResult(
  e: Etzhayyim,
  input: ReceiveHuntResultInput
): Promise<ReceiveHuntResultOutput> {
  if (
    !input.huntId ||
    typeof input.seq !== "number" ||
    !input.kind ||
    !input.targetDid
  ) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = huntResultRkey(input.huntId, input.seq);
  const existing = await e
    .read<HuntResultRecord>({ collection: HUNT_RESULT_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      resultUri: existing.records[0].uri,
      huntId: input.huntId,
      seq: input.seq,
    };
  }
  const record: HuntResultRecord = {
    huntId: input.huntId,
    seq: input.seq,
    kind: input.kind,
    targetDid: input.targetDid,
    sourceDid: input.sourceDid,
    confidencePermille: input.confidencePermille,
    note: input.note,
    receivedAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: HUNT_RESULT_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    resultUri: receipt.uri,
    huntId: input.huntId,
    seq: input.seq,
  };
}

export async function listHuntResults(
  e: Etzhayyim,
  input: ListHuntResultsInput
): Promise<ListHuntResultsOutput> {
  if (!input.huntId) {
    return { items: [], total: 0, error: "missingHuntId" };
  }
  const limit = Math.min(input.limit ?? 100, 200);
  const resp = await e.read<HuntResultRecord>({
    collection: HUNT_RESULT_COLLECTION,
    cursor: input.cursor,
    limit,
  });
  const items: HuntResultView[] = resp.records
    .filter((r) => r.value.huntId === input.huntId)
    .filter((r) => {
      if (input.kind && r.value.kind !== input.kind) return false;
      return true;
    })
    .map((r) => ({ ...r.value, resultUri: r.uri }));
  return { items, cursor: resp.cursor, total: items.length };
}
