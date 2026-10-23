# Feed refresh and deployment

## What runs where

The local project is `C:\Users\Arun\Desktop\sarkari-jobs`. It is the source of truth for code. A push to GitHub `main` starts `.github/workflows/deploy-hostinger.yml`, which uploads the site to Hostinger `public_html` and verifies the published version.

Use Node.js 20 or newer. `package.json` and `package-lock.json` pin the scraper's `cheerio` dependency; install it with `npm ci` from this directory. `node_modules/` is local-only and ignored by Git.

The daily GitHub Actions workflow `.github/workflows/scrape.yml` runs at 02:17 UTC (07:47 India time). It performs these steps in order:

1. `npm run scrape` reads official recruitment portals and writes `../data/jobs.json` plus state feeds.
2. `npm run scrape:competitors` fills information and listing gaps from the long-running competitor indexes SarkariResult.com and FreeJobAlert.com
   (jobs, admit cards, results). One record is kept per listing URL; its type is refined from the newest exam-stage milestone on the linked
   page, and the `.sarkariresult.com.cm` copycat is only used as merge-upgrade input. Stale or undated competitor jobs are removed, and
   `competitor-gap-report.json` records what changed and which gaps remain.
3. `npm run build:details` generates individual listing pages and updates the sitemap.
4. GitHub Actions commits changed feed/page files to `main`. That push starts the Hostinger deployment workflow.

## Running locally

From the `scraper` directory, run each step once, in this order:

```powershell
npm ci
npm run scrape
npm run scrape:competitors
npm run build:details
```

`npm run scrape` only covers official sources; it is not the complete scheduled refresh. The script runs one request per official source page, with four workers and a 6.5-second request timeout. Failed or blocked sources are recorded in `data/jobs.json`; the script preserves prior listings for uncertain sources. Do not automatically rerun the whole scrape after a shell/tool timeout: first check whether `node scrape.js` is still running and inspect the log/output. The GitHub Actions job has a 20-minute limit and is the preferred place to run the full scheduled refresh.

## Publish

For code changes, edit locally, review `git diff`, commit, then push to `main`. GitHub Actions handles the Hostinger upload. The scraper workflow also pushes generated feed/page updates to `main`, which then triggers the same deployment workflow. SFTP credentials stay in GitHub Actions secrets and must not be placed in source files.
