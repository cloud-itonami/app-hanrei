/**
 * hanrei kotoba — barrel.
 *
 * Per ADR-2605203000 Option B Phase E reference implementation.
 * Wave 3 initial slice: 3 of 31 hanrei XRPC commands ported.
 *
 *   registerJurisdiction + getJurisdiction + listJurisdictions
 *     — jurisdiction tier of the hanrei authority chain
 *
 * Remaining 28 commands (court / case / legislation / gazette / etc.)
 * ship in follow-up slices.
 */

export * from "./types.js";
export {
  registerJurisdiction,
  getJurisdiction,
  listJurisdictions,
} from "./jurisdiction.js";
export {
  registerCourtProfiles,
  listCourts,
  collectWikidataCourts,
} from "./court.js";
export {
  seedCases,
  getCase,
  listCases,
  searchCases,
} from "./case.js";
export { registerLaw, getLaw, listLaws } from "./law.js";
export { registerSource, getSource, listSources } from "./source.js";
export {
  registerGazetteEntry,
  getGazetteEntry,
  listGazetteEntries,
} from "./gazette.js";
export { registerDigest, getDigest } from "./digest.js";
export {
  createInformationHunt,
  receiveHuntResult,
  listHuntResults,
} from "./hunt.js";
export {
  coverageStats,
  huntCoverageStats,
  compareJurisdictions,
} from "./stats.js";
export {
  searchDecisions,
  extractCasePersons,
  collectCases,
  collectCaseDetail,
} from "./collect.js";
