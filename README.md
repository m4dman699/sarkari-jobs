# SarkariJobs+

**Live website:** [sarkarijobsplus.com](https://sarkarijobsplus.com)

SarkariJobs+ is a responsive portal for Indian government job notifications, admit cards, and exam results. It brings central and state listings together with application deadlines, exam dates, and links to the relevant source pages.

## Features

- Browse job notifications by category and state.
- See application open and closing dates, countdowns, and exam dates where available.
- Browse recent admit-card and result announcements.
- Search the combined feed and view a map of state-level public service commissions.
- Refresh the data through a scheduled GitHub Actions workflow and publish the website to Hostinger.

## How it works

- The website is built with static HTML, CSS, JavaScript, and JSON data.
- The Node.js scraper collects public recruitment notices and writes the feed under `data/`.
- GitHub Actions runs the scheduled feed refresh and deploys the public site files over SFTP.
- The deployment credentials are stored as GitHub Actions secrets; no credentials belong in project files.

## Run locally

Open `index.html` in a browser, or serve the project folder with any static file server. To run the feed scraper, install the dependencies in `scraper/` with `npm ci`, then run `npm run scrape` from that folder.

## Project

- Website: [https://sarkarijobsplus.com](https://sarkarijobsplus.com)
- Repository: [github.com/m4dman699/sarkari-jobs](https://github.com/m4dman699/sarkari-jobs)
