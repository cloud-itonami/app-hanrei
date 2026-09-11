# app-hanrei

判例・官報・法令 intelligence platform (hanrei.etzhayyim.com) の source-of-record。

**まず読むもの: [`docs/operator-quickstart.md`](docs/operator-quickstart.md)** —
この checkout で実際に走るもの、走らないもの、上流ソースが移転したときの手順。

## このリポジトリの中身（移行後の実態）

`etzhayyim/root` の `60-apps/etzhayyim-project-hanrei` からの移行（`migration.edn`）で、
移ってきたものと移らなかったものがある。**clean checkout から動かせるのは 1 つだけ**:

| 中身 | パス | 状態 |
|---|---|---|
| 上流ソースの目録と検証器 | `data/sources.json` / `tools/verify_sources.cljs` | **動く。** install も credential も不要 |
| 31 XRPC コマンドの参照実装 | `kotoba/` | source は揃っている。test の install は当環境では通らない（quickstart 参照） |
| 上を XRPC として出す Worker | `xrpc-adapter/` | `workspace:*` を宣言しているが workspace root が無く install できない |
| 稼働 agent の記述子 | `appview/etzhayyim-wasm-hanrei-jp-h4nr31jp/kotodama.jsonld` | データ。対応する bundle はこのリポジトリに無い |

## Sources (1次ソース)

正本は **`data/sources.json`** — 各 URL は実際に取得して観測した status を記録している。
`kbb --backend sci tools/verify_sources.cljk .` が全件を再取得して照合する（一致=0 / 相違=1 /
確認できなかった=2。0 件を合格にしない）。

- **判例**: courts.go.jp 裁判例検索の 6 コレクション —
  最高裁判所 / 高等裁判所 / 下級裁判所(速報) / 行政事件 / 労働事件 / 知的財産事件。
  これは `CourtTier` の 6 段（supreme〜summary）**とは別の軸**で、2 つの審級と
  4 つの主題別集からなる。地裁・家裁・簡裁は独立したコレクションを持たず、
  下級裁判所(速報)と各主題別集の中に現れる。
- **官報**: `www.kanpo.go.jp`（2025 年からの電子官報）/ `kanpou.npb.go.jp`（国立印刷局）。
  `www.kanpou.npb.go.jp` は名前解決しない —— www ラベル無しが正。
- **法令**: e-Gov 法令API **v2** `laws.e-gov.go.jp/api/2/`（JSON）。v1 は XML で存続。

## Writer DIDs

6 court DIDs (`did:web:hanrei.etzhayyim.com:court:{id}`) + 2 source DIDs (官報, e-Gov)

⚠ DID と rkey は id を `[^a-z0-9] → "-"` で潰して導出するので、句読点だけが違う 2 つの
id は同じ record に着地する。目録に entry を足すときは id を `[a-z0-9-]` に収める
（詳細は quickstart）。

## Commands

`kotoba/src/index.ts` が export する 31 コマンド。**camelCase が正**
（旧 vendor app の snake_case 名ではない）:

| Tier | Commands |
|---|---|
| jurisdiction | `registerJurisdiction` `getJurisdiction` `listJurisdictions` |
| court | `registerCourtProfiles` `listCourts` `collectWikidataCourts` |
| case | `seedCases` `getCase` `listCases` `searchCases` |
| law | `registerLaw` `getLaw` `listLaws` |
| source | `registerSource` `getSource` `listSources` |
| gazette | `registerGazetteEntry` `getGazetteEntry` `listGazetteEntries` |
| digest | `registerDigest` `getDigest` |
| hunt | `createInformationHunt` `receiveHuntResult` `listHuntResults` |
| stats | `coverageStats` `huntCoverageStats` `compareJurisdictions` |
| collect | `searchDecisions` `extractCasePersons` `collectCases` `collectCaseDetail` |

`collectGazette` / `collectLegislation` は**この repo には無い** —— 旧 vendor app の
コマンドで、移行時に持ち込まれていない。官報・法令は `registerGazetteEntry` /
`registerLaw` と目録側の entry で扱う。

## Build & Deploy

**このリポジトリからはデプロイできない。** 以前ここに書かれていた
`cd wasm/etzhayyim-wasm-hanrei-jp-h4nr31jp && etzhayyim deploy` は、移行で
`wasm/` が持ち込まれなかった時点で踏めない手順になっている（`etzhayyim` CLI も
このワークスペースには無い）。`CLAUDE.md` の deploy 節も同じ理由で履歴として読むこと。

いま回せるのは目録の検証だけで、それは gate として書かれている:

```bash
kbb --backend sci tools/verify_sources.cljk .    # 0=一致 / 1=相違 / 2=確認できなかった
```
