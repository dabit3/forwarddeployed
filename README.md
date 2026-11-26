# Forward Deployed

A job board that lists forward deployed engineering roles and nothing else. The design follows [frankchimero.com](https://frankchimero.com/).

## How it works

- `data/companies.json` lists company job boards on Greenhouse, Lever, and Ashby.
- `src/lib/jobs.ts` fetches each board's public API on the server, caches the results for an hour, and keeps only titles that pass `isForwardDeployedEngineer` in `src/lib/ats.ts`. Besides forward deployed engineer titles, that includes other names for the same role, such as Deployed Engineer, Applied AI Engineer, AI Deployment Engineer and Deployment Strategist.
- `src/lib/roles.ts` groups the same role posted in several cities into one entry.
- Detail pages show the sanitized description and link to the original application page.

## Run it

Requires Node 22.18 or newer.

```sh
npm install
npm run dev
```

## Find more companies

`npm run discover` uses xAI web search, run once for each of those titles, to find Greenhouse, Lever, and Ashby boards that are not yet in `data/companies.json`.
It checks each candidate board's public API and adds a company only if the board has a matching forward deployed engineering role.

If a reviewer drops a candidate as a false positive, add its board slug and the reason under its ATS in `data/rejected-boards.json` so later runs skip it before verification. Discovery matches ATS and slug (case-insensitively for the slug), not the company name. Remove the entry to reconsider that board.

```sh
XAI_API_KEY=... npm run discover
```

Set `XAI_SEARCH_MODEL` to use a model other than `grok-4.20-non-reasoning`.

It also fetches every board already in `data/companies.json` and lists the ones that fail (for example a 404 after a company moves ATS) under `FAILING BOARDS` in its output and in `data/failing-boards.json`. Fix or remove those entries.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```
