# Operator quickstart — app-hanrei

Run the one thing in this repo that runs, see it pass, and see it fail in each of
the ways it is designed to fail. Every command below was executed on 2026-09-01;
the outputs are transcribed, not predicted. Where something was *not* verified —
or could not be — this document says so rather than leaving you to find out.

## What this repo is, and which part of it is live

`app-hanrei` is the Japanese case-law / gazette / legislation surface of
`hanrei.etzhayyim.com`. It arrived here by migration (`migration.edn`) from
`etzhayyim/root` `60-apps/etzhayyim-project-hanrei`, and the migration did not
bring everything. Four parts sit in the tree and only one of them is operable
from a clean checkout:

| Part | Path | State from a clean checkout |
|---|---|---|
| **Upstream source catalogue + its verifier** | `data/sources.json`, `tools/verify_sources.cljs` | **Runs.** No install, no credentials. This is the operator surface. |
| Reference implementation of the 31 XRPC commands | `kotoba/` | 31 command functions are there; its test suite was never reached here — see *Known walls*. |
| Worker that exposes those commands | `xrpc-adapter/` | Cannot install: declares `workspace:*` and this repo has no workspace root. |
| Deployed agent's descriptor | `appview/etzhayyim-wasm-hanrei-jp-h4nr31jp/kotodama.jsonld` | Data, not a build. The bundle it describes is not in this repo. |

The `wasm/` directory that older docs told you to `cd` into **does not exist
here** and neither does an `etzhayyim` CLI on this machine. That instruction
predates the migration; it has been corrected in `README.md`.

## The thing that runs

```bash
kbb --backend sci tools/verify_sources.cljk .
```

```
OK      	source/jp-courts-go-jp	200
OK      	source/jp-ip-high-court	200
OK      	source/jp-kanpo	200
OK      	source/jp-kanpou-npb	200
OK      	source/jp-egov-laws-api-v2	200
OK      	source/jp-egov-laws-api-v1	200
OK      	source/wikidata	200
OK      	collection/saikosai	200
OK      	collection/kotosai	200
OK      	collection/kakyu	200
OK      	collection/gyosei	200
OK      	collection/rodo	200
OK      	collection/chizai	200
SCANNED	13	responded	13
INFO    	known-unreachable	https://www.kanpou.npb.go.jp/	dns-nxdomain
INFO    	known-unreachable	https://kanpo.go.jp/	connect-failed
INFO    	known-unreachable	https://www.courts.go.jp/app/hanrei_jp/search8	404
PASS	all 13 recorded endpoint(s) answered as the catalogue claims
```

Needs `nbb` and outbound HTTPS. It fetches 13 public government endpoints
sequentially — deliberately, not for lack of a `Promise.all`; concurrency here
would buy seconds and spend goodwill. The directory argument is **positional and
comes first**
(`verify_sources.cljs <dir> [--flags]`); pass it after a flag and the flag's
value becomes your repo path.

Read `SCANNED 13 responded 13` before you read `PASS`. It is an evidence floor:
a run that checked nothing would still have to print the count, so "no problems"
and "looked at nothing" cannot come out looking the same.

## The three exit codes, each demonstrated

`0` and `1` are the usual pair. `2` exists because *could not check* must not
print like *checked and found nothing wrong*.

| Exit | Means | Demonstrated by |
|---|---|---|
| **0** | Every recorded-reachable URL returned its recorded status | the run above |
| **1** | The catalogue is internally inconsistent | pointing `courtTiers.mapping.supreme` at a `collectionId` that is not in `caseCollections` |
| **1** | An endpoint no longer answers as recorded | an entry whose `verify.url` is the known-404 `…/hanrei_jp/search8` with `expectStatus: 200` |
| **2** | No catalogue to read | running against a directory with no `data/sources.json` |
| **2** | Catalogue lists zero verifiable URLs | stripping every `verify` block |
| **2** | Not one HTTP response arrived | an entry pointing at a closed port |

Transcripts of all five failing runs (they were actually executed):

```
$ kbb --backend sci tools/verify_sources.cljk /tmp/probe-dangling-tier          # exit 1
FAIL	catalogue is internally inconsistent (1):
  - courtTiers.mapping.supreme -> "no-such-collection" is not a collectionId in caseCollections

$ kbb --backend sci tools/verify_sources.cljk /tmp/probe-404                    # exit 1
MISMATCH	source/probe-404	404	expected 200
SCANNED	1	responded	1
FAIL	1 of 1 endpoint(s) no longer answer as recorded:
  - source/probe-404	https://www.courts.go.jp/app/hanrei_jp/search8	404	expected 200

$ kbb --backend sci tools/verify_sources.cljk /tmp/probe-empty-dir              # exit 2
CANNOT-ANSWER	no catalogue at /tmp/probe-empty-dir/data/sources.json
  This is exit 2, not a pass: nothing was checked.

$ kbb --backend sci tools/verify_sources.cljk /tmp/probe-no-verify-blocks       # exit 2
CANNOT-ANSWER	catalogue lists zero verifiable URLs.
  Refusing to report a pass over an empty set.

$ kbb --backend sci tools/verify_sources.cljk /tmp/probe-closed-port            # exit 2
ERROR   	source/probe-unroutable	no-response: fetch failed	expected 200
SCANNED	1	responded	0
CANNOT-ANSWER	1 URL(s) checked, not one HTTP response arrived.
  This looks like no network from here, not a broken catalogue.
  Reporting exit 2 rather than a failure or a pass.
```

Note the last one. **Exit 2 from your laptop usually means your network, not
their outage.** Check that before you touch the catalogue.

The structural checks run *before* any fetch, so a broken mapping fails in
milliseconds and spends none of the government hosts' goodwill.

## The operator task: an upstream source moved

This is the job the catalogue exists for. Government sites move, hosts lose a
label, an API version is retired — and a decayed catalogue looks exactly like a
fresh one until someone re-fetches it.

1. Run the verifier. A `MISMATCH` line names the `sourceId` or `collectionId`
   and the status actually returned.
2. Find the new address by hand. Do not guess it from the old one.
3. Edit `data/sources.json`:
   - **still reachable, new address** → update `verify.url` (and `homepage` /
     `apiBase` if those moved too).
   - **gone, and you want the finding kept** → move it to `knownUnreachable`
     with the `observed` value you actually saw (`404`, `"dns-nxdomain"`,
     `"connect-failed"`) and a note. Entries there are printed as `INFO` and
     never fetched, so a recorded dead end stays recorded without turning the
     gate red forever.
4. Re-run. Expect exit 0.
5. Update `verifiedAt` to the date you re-fetched on. That field is the whole
   claim the file makes; leaving it stale is the failure mode this tooling exists
   to prevent.

### Two rules when adding an entry

**Nothing aspirational.** An endpoint that you have not fetched does not get a
`sources` entry. If you could not reach it, it belongs in `knownUnreachable`
with what you observed. The file asserts "on `verifiedAt`, this URL returned
this status" — an entry you did not fetch makes that assertion false.

**`sourceId` must be lowercase letters, digits and hyphens.** The rkey and the
DID are derived by `sourceSlug()` in `kotoba/src/source.ts`, which lowercases and
then replaces *every* other character with `-`. That mapping is not injective:

```js
"jp-kanpo" -> "source-jp-kanpo"
"jp.kanpo" -> "source-jp-kanpo"
"jp_kanpo" -> "source-jp-kanpo"
"jp kanpo" -> "source-jp-kanpo"
```

Two ids that differ only in punctuation land on the same record while carrying
different DIDs, and the second registration reports `alreadyExists` handing back
the *first* one's DID. The verifier catches literal duplicate `sourceId`s, not
this collapse. Stay inside `[a-z0-9-]` and it cannot bite you. (The same collapse
exists in the jurisdiction, court, case, law and gazette tiers. Hardening the
derivation is a separate change and is not done here.)

## What the catalogue feeds

The two arrays are shaped so they can be handed to the kotoba commands without
translation — that is why they look the way they do:

| Catalogue array | Shape | Consumed by |
|---|---|---|
| `sources[]` | `RegisterSourceInput` (`kotoba/src/types.ts`) | `registerSource` — registers the upstream provider so `collect*` commands can attach `sourceDid` for provenance |
| `caseCollections[]` | `searchPath` targets | `registerCourtProfiles` / `collectCases` |
| `courtTiers.mapping` | `CourtTier` → `collectionId` | resolving which published collection a tier's decisions appear in |

`courtTiers` carries a note worth reading before you edit it: `CourtTier` has six
values and courts.go.jp publishes six collections, **and they are not the same
six**. The collections are two court tiers plus four subject-matter corpora;
district, family and summary court decisions are not separately published, so
three tiers all map to `kakyu`. Do not "fix" that into a bijection.

## Known walls in this checkout

These were measured here, not assumed. If you hit one, you are not doing it wrong.

### `kotoba/` — three walls before `npm test`

The suite in `kotoba/test/hanrei.test.ts` (24 `it()` blocks against
`@etzhayyim/sdk-mock`) **was not run for this document.** Three separate things
stand between a clean checkout and `npm test`; the first two have workarounds,
the third did not clear on this workstation.

**1. Your `~/.npmrc`, not this repo.**

```
npm error git dep preparation failed
npm error code EALLOWSCRIPTS
npm error --allow-scripts is not allowed in project-scoped installs.
```

This package has git dependencies, and npm >= 11 prepares them in a subprocess
that rejects a user-level `~/.npmrc` containing an `allow-scripts[]` entry. The
message names a flag you never passed and a file you did not edit, so it reads
like a defect here. It is not. Bypass the user config for the install:

```bash
npm_config_userconfig=/dev/null npm install
```

**2. The shared npm cache, if other installs are running.**

```
npm error code EEXIST
npm error syscall rename
npm error path /Users/…/.npm/_cacache/tmp/…
npm error File exists: /Users/…/.npm/_cacache/content-v2/sha512/…
```

A race against another `npm` process on the same machine — this workstation runs
many agent sessions at once. npm rolls the install back, so it looks like a hard
failure rather than a retryable one. Give the run its own cache:

```bash
npm_config_userconfig=/dev/null npm install --cache /tmp/hanrei-npm-cache
```

**3. The transitive git-dependency tree, which is the real cost.**

`kotoba/package.json` names two git dependencies. Preparing them pulls in **eight**,
each cloned over SSH and compiled with `tsc` before npm will link it:

```
etzhayyim/com-etzhayyim-sdk        kotoba-lang/atproto-client   kotoba-lang/ipfs
etzhayyim/com-etzhayyim-sdk-mock   kotoba-lang/base-l2          kotoba-lang/pqh
                                   kotoba-lang/checkpointer     kotoba-lang/witness-quorum
```

With workarounds 1 and 2 applied, that step ran for **15 minutes without
finishing** here (npm 11.19.0, node v26.7.0, load average 30–55). All eight
appeared under `node_modules/@etzhayyim/` (they publish under that scope even
though four of the repos live in `kotoba-lang`), but `node_modules/.bin` stayed empty — vitest was never linked, so `npm test` and
`npm run typecheck` were never reached. Budget for a long first install on an
idle machine, and expect SSH access to both `etzhayyim/*` and `kotoba-lang/*`.

Consequently: **"31 of 31 commands ported" in `kotoba/README.md` and the 24 test
blocks are reported here as what the repo declares, not as what was observed.**
What *was* checked without installing anything: `kotoba/src/*.ts` exports exactly
31 command functions, and every one of them appears in the command table in
`README.md`.

### `xrpc-adapter/` — `workspace:*` with no workspace

`xrpc-adapter/package.json` depends on `"@etzhayyim/hanrei-kotoba": "workspace:*"`.
There is no `package.json` at the repo root and no `workspaces` field anywhere, so
the specifier has nothing to resolve against. npm says so directly:

```
$ npm install --package-lock-only --offline
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
```

Its README's `npm install` / `npm run dev` steps assume the monorepo layout this
repo was migrated *out of*. Reviving the Worker means either adding a workspace
root here or replacing that specifier with a file/git reference; neither is done.

### `wasm/` and the `etzhayyim` CLI

`CLAUDE.md` still describes a `src/app.ts` T3 fallback under
`wasm/etzhayyim-wasm-hanrei-jp-h4nr31jp/`. That directory did not come across in
the migration — what exists is `appview/etzhayyim-wasm-hanrei-jp-h4nr31jp/kotodama.jsonld`,
a descriptor with no bundle beside it. `etzhayyim` is not on PATH on this
machine. Deployment is not driveable from this checkout; treat `CLAUDE.md`'s
deploy section as history.

## Running it on a schedule

The verifier is written to be a gate: positional directory argument, three-valued
exit, evidence floor on stdout. Nothing in it writes to the repo, so it is safe
to run unattended. When it turns red, the two questions in order are

1. `SCANNED n responded 0`? — that is this side of the wire, not theirs.
2. Otherwise, follow *The operator task* above and land the catalogue change.
