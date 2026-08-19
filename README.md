# etzhayyim-project-hanrei

判例・官報・法令 intelligence platform (hanrei.etzhayyim.com)。

TS Native App — WASM 不使用、`@etzhayyim/kotodama-host-sdk` + esbuild。

## Sources (1次ソース)

正本は **`data/sources.json`** — 各 URL は実際に取得して観測した status を記録している。
`nbb tools/verify_sources.cljs .` が全件を再取得して照合する（一致=0 / 相違=1 /
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

## Commands

`collect_cases` / `collect_gazette` / `collect_legislation` — Collection Job Pattern
`list_cases` / `get_case` / `search_cases` / `list_courts` / `list_sources`
`list_gazette_entries` / `list_laws` / `get_digest` / `seed_cases`

## Build & Deploy

```bash
cd wasm/etzhayyim-wasm-hanrei-jp-h4nr31jp
etzhayyim deploy
```
