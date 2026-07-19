/**
 * hanrei kotoba — digest tier (slice 7, +2 → 21/31).
 *
 *   registerDigest  — LLM-generated case summary write
 *                     (rkey=digest-{caseId}-{model})
 *   getDigest       — rkey-direct read for (caseId, model) tuple
 *
 * A digest is a summarization artifact attached to a Case record.
 * Multiple digests per case are supported — one per (caseId, model)
 * tuple. Identical (caseId, model) keys are idempotent / overwrite-free.
 */

import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  HANREI_DID_PREFIX,
  type DigestRecord,
  type DigestView,
  type GetDigestInput,
  type GetDigestOutput,
  type RegisterDigestInput,
  type RegisterDigestOutput,
} from "./types.js";

const DIGEST_COLLECTION = "com.etzhayyim.hanrei.digest";

function digestSlug(caseId: string, model: string): string {
  const c = caseId.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const m = model.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${c}-${m}`;
}

function digestDid(caseId: string, model: string): string {
  return `${HANREI_DID_PREFIX}digest:${digestSlug(caseId, model)}`;
}

function digestRkey(caseId: string, model: string): string {
  return `digest-${digestSlug(caseId, model)}`;
}

export async function registerDigest(
  e: Etzhayyim,
  input: RegisterDigestInput
): Promise<RegisterDigestOutput> {
  if (!input.caseId || !input.model || !input.summary) {
    return { status: "rejected", error: "missingRequiredFields" };
  }
  const rkey = digestRkey(input.caseId, input.model);
  const existing = await e
    .read<DigestRecord>({ collection: DIGEST_COLLECTION, rkey })
    .catch(() => ({ records: [] }));
  if (existing.records[0]?.value) {
    return {
      status: "alreadyExists",
      digestUri: existing.records[0].uri,
      did: existing.records[0].value.did,
      caseId: input.caseId,
      model: input.model,
    };
  }
  const did = digestDid(input.caseId, input.model);
  const record: DigestRecord = {
    did,
    caseId: input.caseId,
    caseDid: input.caseDid,
    model: input.model,
    summary: input.summary,
    keypoints: input.keypoints,
    holdings: input.holdings,
    citedLaws: input.citedLaws,
    language: input.language,
    tokenCount: input.tokenCount,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  const receipt = await e.write({
    collection: DIGEST_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });
  return {
    status: "registered",
    digestUri: receipt.uri,
    did,
    caseId: input.caseId,
    model: input.model,
  };
}

export async function getDigest(
  e: Etzhayyim,
  input: GetDigestInput
): Promise<GetDigestOutput> {
  if (!input.caseId || !input.model) {
    return { error: "missingCaseIdOrModel" };
  }
  const resp = await e
    .read<DigestRecord>({
      collection: DIGEST_COLLECTION,
      rkey: digestRkey(input.caseId, input.model),
    })
    .catch(() => ({ records: [] }));
  const r = resp.records[0];
  if (!r) return { error: "notFound" };
  const view: DigestView = { ...r.value, digestUri: r.uri };
  return { digest: view };
}
