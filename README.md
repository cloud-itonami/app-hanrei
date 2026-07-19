# etzhayyim-project-hanrei

判例・官報・法令 intelligence platform (hanrei.etzhayyim.com)。

TS Native App — WASM 不使用、`@etzhayyim/kotodama-host-sdk` + esbuild。

## Sources (1次ソース)

- **判例**: courts.go.jp (最高裁〜簡裁 6 court)
- **官報**: kanpou.npb.go.jp (judge appointments, legislation)
- **法令**: e-Gov API (elaws.e-gov.go.jp)

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
