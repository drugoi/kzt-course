# SQLite Rate History Design

## Context

The bot publishes daily KZT exchange rates for USD, EUR, and RUB. The RSS feed
currently includes a `<change>` element, and the current parser reads it in a
live check. Historical publications nevertheless did not reliably contain
changes, so the bot must not rely on the RSS change value alone.

The in-progress JSON snapshot implementation stores only one previous value.
It will be replaced with SQLite history before release.

## Goals

- Persist a complete daily history for USD, EUR, and RUB.
- Calculate publication changes from the last complete prior-day snapshot.
- Use the RSS `<change>` value only when no prior snapshot exists.
- Keep the RSS value for diagnostics.
- Make repeated processing of the same date idempotent.
- Preserve exact decimal strings in storage.

## Non-goals

- Migrating the unreleased JSON snapshot file.
- Exposing a history API or user interface.
- Storing currencies other than USD, EUR, and RUB.
- Solving distributed scheduling or concurrent writers.

## SQLite Integration

Use the built-in `node:sqlite` `DatabaseSync` API. The project and production
runtime must use Node.js 22.5 or newer, and the Node.js type dependency must
match the supported runtime.

The database path is configured with `KZT_RATES_DB_FILE`. Its default value is
`data/rates.sqlite`. Production should set an absolute path in a directory that
persists across deployments.

This approach avoids an additional native npm dependency. The synchronous API
is appropriate because the bot performs a few local queries once per day.

## Data Model

```sql
CREATE TABLE IF NOT EXISTS rate_history (
  rate_date TEXT NOT NULL,
  currency TEXT NOT NULL
    CHECK (currency IN ('USD', 'EUR', 'RUB')),
  amount TEXT NOT NULL,
  rss_change TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (rate_date, currency)
) STRICT;
```

- `rate_date` is the RSS publication date normalized to `YYYY-MM-DD`.
- `currency` is one of the three monitored currency codes.
- `amount` is the exact RSS `description` string.
- `rss_change` is the exact parsed RSS `change` string.
- `fetched_at` is an ISO-8601 UTC timestamp.

Amounts remain text in SQLite to avoid binary floating-point changes to source
values. Arithmetic converts decimal strings to scaled integers before
subtraction.

## Processing Flow

1. Fetch and parse the RSS document.
2. Explicitly parse `title`, `description`, `change`, and `pubDate`.
3. Reject the run unless USD, EUR, and RUB are present, numeric, and share one
   valid publication date. Missing `<change>` is an error instead of silently
   becoming zero.
4. Open the database and create the schema if needed.
5. Select the latest earlier date containing all three currencies.
6. If a prior snapshot exists, calculate each change as current minus previous.
   Otherwise, use the RSS change values for the first publication.
7. Compare calculated values with RSS values when both exist. Log a warning
   containing currency, date, calculated value, and RSS value on disagreement.
8. Upsert all three current rows in one transaction.
9. Format and publish the Kazakh text, then the Russian text.
10. Close the database in a `finally` block.

The previous-snapshot query excludes the current date. Reprocessing the same
date therefore produces the same calculated changes instead of comparing the
snapshot with itself. The upsert updates corrections from the RSS source
without creating duplicates.

History is stored before Twitter publication. A Twitter failure therefore does
not discard fetched exchange-rate data, and a retry for the same date still
uses the prior date for its calculation.

## Text Formatting

The direction of each displayed change comes from that currency's calculated
value. Locale templates will no longer hard-code one shared plus or minus sign
for all currencies.

Changes are formatted with up to two decimal places while retaining values such
as `0.01` that the current one-decimal formatter rounds to zero. The overall
`up`, `down`, or `no_change` text variant continues to use USD as the primary
indicator and falls back to EUR and RUB when USD is unchanged.

## Failure Handling

- Invalid or incomplete RSS data stops the run before database writes or
  publication.
- Database open, schema, query, or transaction errors stop publication.
- A failed transaction leaves no partial three-currency snapshot.
- Twitter errors retain the already-recorded history and propagate in
  production as they do today.
- The SQLite database file and its sidecar files are ignored by Git.

## Testing

- Parser regression test using a realistic RSS fragment with signed
  `<change>` values and `pubDate`.
- In-memory SQLite tests for schema creation, first insert, prior complete
  snapshot lookup, same-day upsert, and incomplete snapshot exclusion.
- Decimal arithmetic tests including `5.00 - 5.10 = -0.1`.
- Integration test for first-run RSS fallback.
- Integration test for two sequential dates calculated from SQLite.
- Integration test proving a repeated date still compares with the prior date.
- Formatting test for mixed currency directions and a `0.01` change.
- Existing tests, TypeScript checks, lint, and whitespace checks remain green.

## Rollout

1. Deploy with Node.js 22.5 or newer.
2. Configure `KZT_RATES_DB_FILE` to a persistent absolute path.
3. The first run with a valid complete RSS response creates the schema, uses
   RSS changes, and records the initial snapshot.
4. Subsequent dates calculate changes from SQLite history.
