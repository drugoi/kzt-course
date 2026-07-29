# kzt-twitter

Twitter bot for posting Kazakhstan Tenge exchange-rate tweets.

## Prerequisites

- Node.js 22.5+, matching the GitHub Actions CI environment.
- Twitter API credentials for an account allowed to publish tweets.

## Setup

Install dependencies:

```sh
npm ci
```

Create a local environment file:

```sh
cp .env.example .env
```

Fill `.env` with the required Twitter credentials:

```sh
KZT_TWITTER_ACCESS_TOKEN=
KZT_TWITTER_ACCESS_TOKEN_SECRET=
KZT_TWITTER_CONSUMER_KEY=
KZT_TWITTER_CONSUMER_SECRET=
```

Optional runtime flags are also listed in `.env.example`:

```sh
NODE_ENV=development
DEBUG=false
FORCE_UPDATE=false
KZT_RATES_DB_FILE=
```

Rate history lives in `data/rates.sqlite` by default. In production, set
`KZT_RATES_DB_FILE` to an absolute persistent path if runtime data should live
outside the deployment directory. The configured location must persist across
restarts and deployments.

The first stored date uses the RSS `<change>` values. For later dates, the bot
calculates changes from the latest complete earlier snapshot of USD, EUR, and
RUB rates.

## Commands

```sh
npm start
npm test
npm run typecheck
npm run lint
```

## Security

Never commit `.env` or any real credential values. If a credential is exposed in
git, logs, issue trackers, or shared documentation, rotate the affected Twitter
credential immediately.
