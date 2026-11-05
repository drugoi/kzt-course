# kzt-twitter

Twitter bot for posting Kazakhstan Tenge exchange-rate tweets.

## Prerequisites

- Node.js 22.13.0+, matching the GitHub Actions CI environment.
- A Buffer account with the project X channel connected and a personal API key.

## Setup

Install dependencies:

```sh
npm ci
```

Create a local environment file:

```sh
cp .env.example .env
```

Fill `.env` with the Buffer key and the IDs of the connected X and Threads channels:

```sh
BUFFER_API_KEY=
BUFFER_CHANNEL_IDS=
```

With `BUFFER_API_KEY` set, posts go through Buffer using `shareNow` at the
existing daily 09:00 Asia/Almaty schedule, Kazakh first and Russian second.
Channel IDs are comma-separated and deduplicated. Each channel receives Kazakh
then Russian; a failed post does not block remaining posts or channels. Partial
failures are reported after all deliveries have been attempted. Successful posts
are not automatically retried. The legacy `BUFFER_CHANNEL_ID` setting is supported
when `BUFFER_CHANNEL_IDS` is unset.

The bot does not publish automatically on production startup. Buffer failures
never fall back to the paid X API. Accepted post IDs are logged; acceptance
by Buffer is not confirmation of final delivery to X. The Free queue limit
is concurrent, not a monthly publication limit.

Without a Buffer key, legacy direct X API credentials in `.env.example` are
still supported. To migrate back, remove the Buffer key explicitly.

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
git, logs, issue trackers, or shared documentation, rotate the affected credential immediately.
