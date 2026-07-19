/**
 * hanrei XRPC adapter — CF Worker.
 *
 * Wires the kotoba reference impl (31 pure TS functions across 10 tiers)
 * into a deployable CF Worker that exposes each function as an XRPC endpoint
 * at https://hanrei.etzhayyim.com/xrpc/com.etzhayyim.hanrei.<cmd>
 *
 * Per ADR-2605210000 first execution-layer demonstration. Instantiates the
 * Etzhayyim SDK from env bindings (PDS_URL + session), calls the kotoba
 * function with parsed input, returns the result as JSON, and maps status
 * codes to HTTP responses.
 *
 * Single-file principle: all routing and handler logic here.
 */

import {
  createAuthedEtzhayyim,
  extractBearerToken,
  type Etzhayyim,
} from "@etzhayyim/sdk-auth";
import * as hanreiRwFree from "@etzhayyim/hanrei-kotoba";

interface Env {
  ACTOR_DID: string;
  PDS_URL: string;
  L2_RPC_URL: string;
  PDS_ACCESS_JWT?: string;
  PDS_REFRESH_JWT?: string;
}

type Handler = (e: Etzhayyim, input: unknown) => Promise<unknown>;

const NSID_BASE = "com.etzhayyim.hanrei";

interface RouteConfig {
  method: "POST" | "GET";
  handler: Handler;
}

const routes: Record<string, RouteConfig> = {
  // Jurisdiction tier (3 commands)
  [`${NSID_BASE}.registerJurisdiction`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.registerJurisdiction(e, input as any),
  },
  [`${NSID_BASE}.getJurisdiction`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.getJurisdiction(e, input as any),
  },
  [`${NSID_BASE}.listJurisdictions`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.listJurisdictions(e, input as any),
  },

  // Court tier (3 commands)
  [`${NSID_BASE}.registerCourtProfiles`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.registerCourtProfiles(e, input as any),
  },
  [`${NSID_BASE}.listCourts`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.listCourts(e, input as any),
  },
  [`${NSID_BASE}.collectWikidataCourts`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.collectWikidataCourts(e, input as any),
  },

  // Case tier (4 commands)
  [`${NSID_BASE}.seedCases`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.seedCases(e, input as any),
  },
  [`${NSID_BASE}.getCase`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.getCase(e, input as any),
  },
  [`${NSID_BASE}.listCases`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.listCases(e, input as any),
  },
  [`${NSID_BASE}.searchCases`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.searchCases(e, input as any),
  },

  // Law tier (3 commands)
  [`${NSID_BASE}.registerLaw`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.registerLaw(e, input as any),
  },
  [`${NSID_BASE}.getLaw`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.getLaw(e, input as any),
  },
  [`${NSID_BASE}.listLaws`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.listLaws(e, input as any),
  },

  // Source tier (3 commands)
  [`${NSID_BASE}.registerSource`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.registerSource(e, input as any),
  },
  [`${NSID_BASE}.getSource`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.getSource(e, input as any),
  },
  [`${NSID_BASE}.listSources`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.listSources(e, input as any),
  },

  // Gazette tier (3 commands)
  [`${NSID_BASE}.registerGazetteEntry`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.registerGazetteEntry(e, input as any),
  },
  [`${NSID_BASE}.getGazetteEntry`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.getGazetteEntry(e, input as any),
  },
  [`${NSID_BASE}.listGazetteEntries`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.listGazetteEntries(e, input as any),
  },

  // Digest tier (1 command)
  [`${NSID_BASE}.registerDigest`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.registerDigest(e, input as any),
  },
  [`${NSID_BASE}.getDigest`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.getDigest(e, input as any),
  },

  // Hunt tier (3 commands)
  [`${NSID_BASE}.createInformationHunt`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.createInformationHunt(e, input as any),
  },
  [`${NSID_BASE}.receiveHuntResult`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.receiveHuntResult(e, input as any),
  },
  [`${NSID_BASE}.listHuntResults`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.listHuntResults(e, input as any),
  },

  // Stats tier (3 commands)
  [`${NSID_BASE}.coverageStats`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.coverageStats(e, input as any),
  },
  [`${NSID_BASE}.huntCoverageStats`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.huntCoverageStats(e, input as any),
  },
  [`${NSID_BASE}.compareJurisdictions`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.compareJurisdictions(e, input as any),
  },

  // Collect tier (4 commands)
  [`${NSID_BASE}.searchDecisions`]: {
    method: "GET",
    handler: (e, input) => hanreiRwFree.searchDecisions(e, input as any),
  },
  [`${NSID_BASE}.extractCasePersons`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.extractCasePersons(e, input as any),
  },
  [`${NSID_BASE}.collectCases`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.collectCases(e, input as any),
  },
  [`${NSID_BASE}.collectCaseDetail`]: {
    method: "POST",
    handler: (e, input) => hanreiRwFree.collectCaseDetail(e, input as any),
  },
};

/**
 * Maps result.status to HTTP status code.
 *   - rejected / invalidIsin / invalidChecksum / invalidLei / invalidGtin / missingRequiredFields / invalidPaperId → 400
 *   - notFound / paperNotFound / itemNotFound / accountNotFound / asnNotFound / prefixNotFound / certificateNotFound / fermentNotFound / requestNotFound / artifactNotFound / vulnMatchNotFound / absorbNotFound → 404
 *   - alreadyExists / alreadyProcessed / alreadyReleased / alreadyAnchored → 200 (idempotent)
 *   - other / default → 200
 *   - exception → 500
 */
function mapStatus(status?: string): number {
  if (
    status === "rejected" ||
    status === "invalidIsin" ||
    status === "invalidChecksum" ||
    status === "invalidLei" ||
    status === "invalidGtin" ||
    status === "missingRequiredFields" ||
    status === "invalidPaperId"
  ) {
    return 400;
  }
  if (
    status === "notFound" ||
    status === "paperNotFound" ||
    status === "itemNotFound" ||
    status === "accountNotFound" ||
    status === "asnNotFound" ||
    status === "prefixNotFound" ||
    status === "certificateNotFound" ||
    status === "fermentNotFound" ||
    status === "requestNotFound" ||
    status === "artifactNotFound" ||
    status === "vulnMatchNotFound" ||
    status === "absorbNotFound"
  ) {
    return 404;
  }
  if (
    status === "alreadyExists" ||
    status === "alreadyProcessed" ||
    status === "alreadyReleased" ||
    status === "alreadyAnchored"
  ) {
    return 200;
  }
  return 200;
}

function jsonResponse(
  body: unknown,
  status: number = 200,
  init?: ResponseInit
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
    ...init,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Only handle /xrpc/* paths
    if (!url.pathname.startsWith("/xrpc/")) {
      return jsonResponse({ error: "NotFound" }, 404);
    }

    const nsid = url.pathname.slice("/xrpc/".length);
    const route = routes[nsid];

    if (!route) {
      return jsonResponse({ error: "MethodNotFound", nsid }, 404);
    }

    if (req.method !== route.method) {
      return jsonResponse({ error: "MethodNotAllowed" }, 405);
    }

    // Instantiate Etzhayyim SDK with PDS session attached
    const bearerToken = extractBearerToken(req);
    const e = createAuthedEtzhayyim({
      env: {
        ACTOR_DID: env.ACTOR_DID,
        PDS_URL: env.PDS_URL,
        L2_RPC_URL: env.L2_RPC_URL,
        PDS_ACCESS_JWT: env.PDS_ACCESS_JWT,
        PDS_REFRESH_JWT: env.PDS_REFRESH_JWT,
      },
      bearerToken,
    });

    // Parse input based on method
    let input: unknown;
    try {
      if (route.method === "POST") {
        input = await req.json().catch(() => ({}));
      } else {
        // GET: parse query params
        input = Object.fromEntries(url.searchParams.entries());
        // Coerce common numeric/boolean fields
        const typed = input as Record<string, unknown>;
        const numericFields = [
          "limit",
          "offset",
          "maxScan",
          "amountMinor",
          "seq",
          "depth",
          "recentScans",
          "asnNumber",
          "scorePermille",
          "capacityFactorPermille",
          "voltageV",
          "primaryVoltageKv",
          "secondaryVoltageKv",
          "capacityMva",
          "capacityKw",
          "customerCount",
          "lengthM",
          "kwhCumulative",
          "kwDemand",
          "targetReductionKw",
          "actualReductionKw",
          "outputKw",
          "articleCount",
          "snapshotCount",
          "ruleSeq",
          "readingSeq",
          "outputSeq",
          "deviationPercentPermille",
          "affectedCustomers",
          "confidencePermille",
        ];
        numericFields.forEach((field) => {
          if (typed[field]) {
            typed[field] = Number(typed[field]);
          }
        });
        const booleanFields = [
          "includeBalance",
          "publicNoticeOnly",
          "publicDomainOnly",
          "released",
        ];
        booleanFields.forEach((field) => {
          if (typed[field]) {
            typed[field] = typed[field] === "true";
          }
        });
      }
    } catch (err) {
      return jsonResponse(
        {
          error: "InvalidInput",
          message: `Failed to parse ${route.method === "POST" ? "JSON" : "query params"}`,
        },
        400
      );
    }

    // Call handler
    try {
      const result = await route.handler(e, input);
      const status = mapStatus(
        (result as Record<string, unknown>)?.status as string | undefined
      );
      return jsonResponse(result, status);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse(
        {
          error: "InternalError",
          message,
          nsid,
        },
        500
      );
    }
  },
} satisfies ExportedHandler<Env>;
