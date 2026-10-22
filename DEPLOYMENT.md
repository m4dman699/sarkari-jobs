# Automatic Hostinger publishing

The site is static HTML/CSS/JavaScript. GitHub Actions runs one scraper pass per day at 02:17 UTC (07:47 India time), commits refreshed feed data, and uploads the site and `data/` over SFTP. The scraper visits each configured portal once per run, then exits. A separate workflow uploads manually committed site changes to Hostinger after a push to `main`.

The Desktop checkout is synced from `origin/main` once daily at 08:45 India time by the Windows Scheduled Task **SarkariJobsPlus GitHub Sync**. The task fast-forwards only when the checkout is clean; it skips and logs a message if there are uncommitted local changes. Review `%LOCALAPPDATA%\SarkariJobsPlus\sync.log` for sync status. Local edits still follow the normal path: edit on Desktop, commit and push to GitHub `main`, then the deploy workflow publishes that revision to Hostinger.

## One-time setup

1. In Hostinger, open the website's **FTP Accounts / SSH access** settings, enable SFTP access, and note the SFTP host, username, and website folder path. Hostinger's standard hosting SFTP port is `65002`.
2. In GitHub, open **m4dman699/sarkari-jobs → Settings → Secrets and variables → Actions** and create these repository secrets:
   - `HOSTINGER_SFTP_HOST` — the SFTP host shown in Hostinger.
   - `HOSTINGER_SFTP_USER` — the SFTP username.
   - `HOSTINGER_SFTP_PASSWORD` — the SFTP password.
   - `HOSTINGER_SFTP_REMOTE_DIR` — the full remote path to this domain's `public_html` folder.
3. Run **Actions → Refresh government job feed → Run workflow** once to scrape and publish immediately. Future scheduled runs scrape and publish automatically; pushes to `main` publish site edits.

Google Analytics 4 is connected for `https://sarkarijobsplus.com`. Its public `G-...` Measurement ID is stored in `js/analytics-config.js`; it is not a password or API secret. The optional `GA4_MEASUREMENT_ID` Actions secret can override the file value during deployment, but it is not required.

The uploader only writes the site's HTML pages, `robots.txt`, `sitemap.xml`, and the `assets/`, `css/`, `js/`, and `data/` directories. It does not delete remote files, preserving Hostinger-managed files such as `default.php`.

## Recruitment date and source policy

The scraper reads recruiting authorities' own portals and official notices first. It has dedicated date-field readers for the Ministry of Information and Broadcasting's Employment News table and ISRO's Current Opportunities table. The dates come from the fields explicitly labelled issue/opening and last date; dates are not inferred from unrelated page text. Other recruitment sources use the official listing row/card around each notice. If a portal does not expose a deadline in its public listing, the card tells candidates to check the official notice instead of inventing a date. Third-party job sites are useful for discovering notices and comparing presentation, but dates and links must be checked against the recruiting body or its notice before publishing.

## Audience analytics and Google Search

The pages load GA4 using the configured public Measurement ID. Listing detail pages also include the analytics loader. Check **Reports → Realtime** in Analytics to confirm visits are arriving. Google documents the Measurement ID and tag setup in its [GA4 tag guide](https://support.google.com/analytics/answer/9311124).

For Google indexing, the `sarkarijobsplus.com` **Domain** property is verified through the Hostinger DNS TXT record and `https://sarkarijobsplus.com/sitemap.xml` is submitted successfully. Keep the verification record in DNS. The homepage is indexed. Search Console last reported 319 discovered pages before the four new trust pages and listing cleanup in this update; resubmit or allow Google to reread the updated sitemap. Google says sitemap submission and crawl requests help discovery but do not guarantee indexing or ranking; allow time for crawling.

## Publisher readiness

The website includes About, Contact, Privacy, and Editorial/Sourcing pages linked from its footers. The privacy policy describes current GA4 use and says advertising is not enabled yet; update it before serving any advertising. The feed and generated detail pages exclude third-party navigation pages such as privacy policies so they cannot be shown as job listings. Ad approval is determined by Google and is not guaranteed; review pages for original, accurate explanations and official source links before applying.
