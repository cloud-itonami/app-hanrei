import { describe, it, expect, beforeEach } from "vitest";
import { MockEtzhayyim } from "@etzhayyim/sdk-mock";
import {
  registerJurisdiction,
  getJurisdiction,
  listJurisdictions,
  seedCases,
  getCase,
  listCases,
  searchCases,
} from "../src/index.js";

describe("hanrei kotoba", () => {
  let e: any;

  beforeEach(() => {
    e = new MockEtzhayyim({ did: "did:web:hanrei.etzhayyim.com" });
  });

  describe("registerJurisdiction", () => {
    it("registers a new jurisdiction with valid input", async () => {
      const result = await registerJurisdiction(e, {
        iso3: "JPN",
        name: "Japan",
        nameLocal: "日本",
        legalSystem: "civil-law",
        primaryLanguage: "ja",
      });

      expect(result.status).toBe("registered");
      expect(result.jurisdictionUri).toBeDefined();
      expect(result.did).toBeDefined();
      expect(result.iso3).toBe("JPN");
    });

    it("rejects jurisdiction with missing iso3", async () => {
      const result = await registerJurisdiction(e, {
        iso3: "",
        name: "Invalid",
      });

      expect(result.status).toBe("rejected");
      expect(result.error).toBeDefined();
    });

    it("is idempotent on iso3", async () => {
      const input = {
        iso3: "GBR",
        name: "United Kingdom",
        legalSystem: "common-law" as const,
      };

      const first = await registerJurisdiction(e, input);
      expect(first.status).toBe("registered");
      const firstDid = first.did;

      const second = await registerJurisdiction(e, input);
      expect(second.status).toBe("alreadyExists");
      expect(second.did).toBe(firstDid);
    });

    it("normalizes iso3 to uppercase", async () => {
      const result = await registerJurisdiction(e, {
        iso3: "fra",
        name: "France",
      });

      expect(result.status).toBe("registered");
      const juris = await getJurisdiction(e, { iso3: "FRA" });
      expect(juris.jurisdiction?.iso3).toBe("fra");
    });
  });

  describe("getJurisdiction", () => {
    beforeEach(async () => {
      await registerJurisdiction(e, {
        iso3: "JPN",
        name: "Japan",
        legalSystem: "civil-law",
      });
    });

    it("retrieves an existing jurisdiction", async () => {
      const result = await getJurisdiction(e, { iso3: "JPN" });

      expect(result.error).toBeUndefined();
      expect(result.jurisdiction).toBeDefined();
      expect(result.jurisdiction?.iso3).toBe("JPN");
    });

    it("returns error for non-existent jurisdiction", async () => {
      const result = await getJurisdiction(e, { iso3: "ZZZ" });

      expect(result.error).toBe("notFound");
      expect(result.jurisdiction).toBeUndefined();
    });

    it("returns error when iso3 is missing", async () => {
      const result = await getJurisdiction(e, { iso3: "" });

      expect(result.error).toBeDefined();
    });
  });

  describe("listJurisdictions", () => {
    beforeEach(async () => {
      await registerJurisdiction(e, {
        iso3: "JPN",
        name: "Japan",
        legalSystem: "civil-law",
      });
      await registerJurisdiction(e, {
        iso3: "GBR",
        name: "United Kingdom",
        legalSystem: "common-law",
      });
      await registerJurisdiction(e, {
        iso3: "FRA",
        name: "France",
        legalSystem: "civil-law",
      });
    });

    it("lists all jurisdictions", async () => {
      const result = await listJurisdictions(e, {});

      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it("filters by legalSystem", async () => {
      const result = await listJurisdictions(e, { legalSystem: "civil-law" });

      expect(result.items.length).toBe(2);
      expect(result.items.every((j) => j.legalSystem === "civil-law")).toBe(
        true
      );
    });

    it("respects limit parameter", async () => {
      const result = await listJurisdictions(e, { limit: 2 });

      expect(result.items.length).toBeLessThanOrEqual(2);
    });
  });

  describe("seedCases", () => {
    beforeEach(async () => {
      await registerJurisdiction(e, {
        iso3: "JPN",
        name: "Japan",
      });
    });

    it("seeds cases with valid input", async () => {
      const result = await seedCases(e, {
        cases: [
          {
            caseId: "2023-0001",
            title: "Sample Case",
            jurisdiction: "JPN",
          },
        ],
      });

      expect(result.status).toBe("ok");
      expect(result.inserted).toHaveLength(1);
      expect(result.inserted?.[0]?.caseId).toBe("2023-0001");
    });

    it("rejects empty cases array", async () => {
      const result = await seedCases(e, { cases: [] });

      expect(result.status).toBe("rejected");
      expect(result.error).toBe("missingCases");
    });

    it("is idempotent on caseId", async () => {
      const caseInput = {
        caseId: "2023-0001",
        title: "Sample Case",
      };

      const first = await seedCases(e, { cases: [caseInput] });
      expect(first.status).toBe("ok");
      expect(first.inserted).toHaveLength(1);

      const second = await seedCases(e, { cases: [caseInput] });
      expect(second.skipped).toHaveLength(1);
      expect(second.skipped?.[0]?.reason).toBe("alreadyExists");
    });

    it("skips cases with missing fields", async () => {
      const result = await seedCases(e, {
        cases: [
          {
            caseId: "2023-0001",
            title: "Valid Case",
          },
          {
            caseId: "",
            title: "Invalid Case",
          },
        ],
      });

      expect(result.inserted).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
    });
  });

  describe("getCase", () => {
    beforeEach(async () => {
      await seedCases(e, {
        cases: [
          {
            caseId: "2023-001",
            title: "Test Case",
            jurisdiction: "JPN",
          },
        ],
      });
    });

    it("retrieves an existing case", async () => {
      const result = await getCase(e, { caseId: "2023-001" });

      expect(result.error).toBeUndefined();
      expect(result.case).toBeDefined();
      expect(result.case?.caseId).toBe("2023-001");
    });

    it("returns error for non-existent case", async () => {
      const result = await getCase(e, { caseId: "9999-999" });

      expect(result.error).toBe("notFound");
      expect(result.case).toBeUndefined();
    });

    it("returns error when caseId is missing", async () => {
      const result = await getCase(e, { caseId: "" });

      expect(result.error).toBeDefined();
    });
  });

  describe("listCases", () => {
    beforeEach(async () => {
      await seedCases(e, {
        cases: [
          {
            caseId: "2023-001",
            title: "High Court Decision",
            jurisdiction: "JPN",
          },
          {
            caseId: "2023-002",
            title: "District Court Ruling",
            jurisdiction: "JPN",
          },
        ],
      });
    });

    it("lists all cases", async () => {
      const result = await listCases(e, {});

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it("filters by jurisdiction", async () => {
      const result = await listCases(e, { jurisdiction: "JPN" });

      expect(result.items.length).toBe(2);
      expect(result.items.every((c) => c.jurisdiction === "JPN")).toBe(true);
    });

    it("respects limit parameter", async () => {
      const result = await listCases(e, { limit: 1 });

      expect(result.items.length).toBeLessThanOrEqual(1);
    });
  });

  describe("searchCases", () => {
    beforeEach(async () => {
      await seedCases(e, {
        cases: [
          {
            caseId: "2023-001",
            title: "Patent Dispute Resolution",
            summary: "Intellectual property case",
          },
          {
            caseId: "2023-002",
            title: "Employment Rights",
            summary: "Labor law enforcement",
          },
        ],
      });
    });

    it("searches cases by query", async () => {
      const result = await searchCases(e, { query: "patent" });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0]?.title).toContain("Patent");
    });

    it("returns empty results for no matches", async () => {
      const result = await searchCases(e, { query: "nonexistent" });

      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it("returns empty results when query is empty", async () => {
      const result = await searchCases(e, { query: "" });

      expect(result.items.length).toBe(0);
    });

    it("searches case summaries", async () => {
      const result = await searchCases(e, { query: "labor" });

      expect(result.items.length).toBeGreaterThan(0);
    });
  });
});
