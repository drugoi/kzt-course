# SQLite Rate History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist daily USD, EUR, and RUB history in SQLite and calculate correctly signed publication changes from the latest complete prior date.

**Architecture:** Parse RSS fields without silently substituting zero, convert the three monitored rates into a validated domain snapshot, and store snapshots through a focused `RateHistory` repository backed by `node:sqlite`. The bot queries the prior complete date, calculates exact decimal differences when possible, falls back to RSS changes on the first date, stores the current snapshot transactionally, and then publishes correctly signed localized text.

**Tech Stack:** TypeScript 5, Node.js 22.13.0+ built-in `node:sqlite`, Jest/ts-jest, fast-xml-parser, PM2 production runtime.

## Global Constraints

- Use Node.js 22.13.0 or newer; production currently runs Node.js 22.22.2 under PM2.
- Use built-in `node:sqlite`; do not add `better-sqlite3`, `sqlite3`, or another runtime database dependency.
- Store exact RSS decimal values as SQLite `TEXT`.
- Store only USD, EUR, and RUB.
- Use `KZT_RATES_DB_FILE`; default to `data/rates.sqlite`.
- Calculate changes from the latest complete earlier date; use RSS `<change>` only when no earlier complete date exists.
- Reprocessing one date must still compare with the earlier date.
- Store the current complete snapshot before attempting Twitter publication.
- All implementation commits use Conventional Commits with an Angular-style scope.

---

## File Structure

- Create `src/decimal.ts`: validate, normalize, subtract, compare, and display signed decimal strings.
- Create `src/rates.ts`: turn parsed monitored rates into a validated `RateSnapshot` and build a `CurrenciesMap` from current and previous snapshots.
- Create `src/history.ts`: own SQLite schema creation, prior snapshot queries, transactional upserts, and connection lifecycle.
- Create `src/__tests__/decimal.test.ts`: exact decimal arithmetic and display coverage.
- Create `src/__tests__/rates.test.ts`: snapshot validation, date normalization, and RSS fallback coverage.
- Create `src/__tests__/history.test.ts`: real in-memory SQLite repository coverage.
- Modify `src/types.ts`: export `Rate`, `CurrencyCode`, `StoredRate`, and `RateSnapshot` domain types.
- Modify `src/parse.ts`: preserve explicit RSS field values and stop replacing a missing `<change>` with zero.
- Modify `src/format.ts`: render the actual sign for each currency and retain changes as small as `0.01`.
- Modify `src/locales/ru.json`: remove hard-coded shared signs from change placeholders.
- Modify `src/locales/kk.json`: remove hard-coded shared signs from change placeholders.
- Modify `src/index.ts`: coordinate parsing, history lookup, change calculation, diagnostics, persistence, formatting, and publication.
- Modify `src/__tests__/parse.test.ts`: add realistic signed RSS and missing-change regression cases.
- Modify `src/__tests__/format.test.ts`: assert mixed signs and two-decimal changes.
- Modify `src/__tests__/integration.test.ts`: replace JSON-state tests with real SQLite history scenarios.
- Modify `package.json`: require Node.js 22.13.0+ and align `@types/node` with Node.js 22.
- Modify `package-lock.json`: capture the Node type dependency update.
- Modify `.env.example`: replace `KZT_RATES_STATE_FILE` with `KZT_RATES_DB_FILE`.
- Modify `.gitignore`: ignore `data/` including SQLite database and sidecar files.
- Modify `README.md`: document SQLite history, first-run fallback, persistent path, and production runtime.
- Delete `src/state.ts`: remove the unreleased JSON snapshot implementation.

---

### Task 1: Preserve and Validate RSS Change Data

**Files:**
- Modify: `src/types.ts`
- Modify: `src/parse.ts`
- Modify: `src/__tests__/parse.test.ts`

**Interfaces:**
- Produces: exported `Rate` interface and `Rates = Rate[]`.
- Produces: `parseXml(xml: string): Promise<Rates>`.
- Contract: missing `description`, `change`, or `pubDate` becomes an empty string for downstream validation, never a fabricated numeric zero.

- [ ] **Step 1: Add a failing parser regression test**

Add these cases inside `describe('parseXml')`:

```ts
it('should preserve signed change and publication date from RSS', async () => {
  const xml = `
    <rss>
      <channel>
        <item>
          <title>USD</title>
          <pubDate>28.07.2026</pubDate>
          <description>473.4</description>
          <quant>1</quant>
          <index>DOWN</index>
          <change>-2.67</change>
          <link></link>
        </item>
      </channel>
    </rss>
  `

  await expect(parseXml(xml)).resolves.toEqual([
    {
      title: 'USD',
      pubDate: '28.07.2026',
      description: '473.4',
      quant: '1',
      index: 'DOWN',
      change: '-2.67',
      link: ''
    }
  ])
})

it('should not fabricate a zero change when RSS omits change', async () => {
  const xml = `
    <rss>
      <channel>
        <item>
          <title>USD</title>
          <pubDate>28.07.2026</pubDate>
          <description>473.4</description>
        </item>
      </channel>
    </rss>
  `

  const [rate] = await parseXml(xml)

  expect(rate.change).toBe('')
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/parse.test.ts
```

Expected: the missing-change test fails because the current parser returns
`"0"`; the realistic RSS case may expose empty-element normalization
differences and must pass with the final literal shape above.

- [ ] **Step 3: Export the concrete `Rate` type**

Replace the private `Rate` declaration in `src/types.ts` with:

```ts
export interface Rate {
  title: string
  pubDate: string
  description: string
  quant: string
  index: string
  change: string
  link: string
}

export type Rates = Rate[]
```

- [ ] **Step 4: Normalize parser fields without numeric defaults**

In `src/parse.ts`, add:

```ts
const toText = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value)
```

Map each item explicitly:

```ts
return ratesArray.map((rate: Record<string, unknown>) => ({
  title: toText(rate?.title),
  pubDate: toText(rate?.pubDate),
  description: toText(rate?.description),
  quant: toText(rate?.quant),
  index: toText(rate?.index),
  change: toText(rate?.change),
  link: toText(rate?.link)
}))
```

Keep `numberParseOptions.skipLike: /./` so source decimals stay strings.

- [ ] **Step 5: Run parser tests and all static checks**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/parse.test.ts
rtk npm run typecheck
rtk npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit the parser fix**

```bash
rtk git add src/types.ts src/parse.ts src/__tests__/parse.test.ts
rtk git commit -m "fix(parser): preserve rss change values"
```

---

### Task 2: Exact Decimal Arithmetic and Per-Currency Signs

**Files:**
- Create: `src/decimal.ts`
- Create: `src/__tests__/decimal.test.ts`
- Modify: `src/format.ts`
- Modify: `src/locales/ru.json`
- Modify: `src/locales/kk.json`
- Modify: `src/__tests__/format.test.ts`

**Interfaces:**
- Produces: `subtractDecimals(current: string, previous: string): string`.
- Produces: `normalizeDecimal(value: string): string`.
- Produces: `formatSignedChange(value: string): string`.
- Consumes: existing `CurrenciesMap` and locale templates.

- [ ] **Step 1: Write failing exact arithmetic tests**

Create `src/__tests__/decimal.test.ts`:

```ts
import {
  formatSignedChange,
  normalizeDecimal,
  subtractDecimals
} from '../decimal'

describe('decimal helpers', () => {
  it.each([
    ['450.00', '448.50', '1.5'],
    ['480.00', '482.25', '-2.25'],
    ['5.00', '5.10', '-0.1'],
    ['473.40', '473.40', '0']
  ])('subtracts %s minus %s exactly', (current, previous, expected) => {
    expect(subtractDecimals(current, previous)).toBe(expected)
  })

  it.each([
    ['+01.500', '1.5'],
    ['-0.010', '-0.01'],
    ['0.00', '0']
  ])('normalizes %s to %s', (value, expected) => {
    expect(normalizeDecimal(value)).toBe(expected)
  })

  it.each([
    ['1.5', '+1.5'],
    ['-2.25', '-2.25'],
    ['0.01', '+0.01'],
    ['1.236', '+1.24'],
    ['0', '0']
  ])('formats %s as signed %s', (value, expected) => {
    expect(formatSignedChange(value)).toBe(expected)
  })

  it('rejects a non-decimal value', () => {
    expect(() => normalizeDecimal('invalid')).toThrow('Invalid decimal')
  })
})
```

- [ ] **Step 2: Run decimal tests and verify RED**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/decimal.test.ts
```

Expected: FAIL because `src/decimal.ts` does not exist.

- [ ] **Step 3: Implement exact scaled-integer decimal helpers**

Create `src/decimal.ts` around this representation:

```ts
interface ParsedDecimal {
  coefficient: bigint
  scale: number
}

const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/

const parseDecimal = (value: string): ParsedDecimal => {
  const match = DECIMAL_PATTERN.exec(value.trim())
  if (!match) {
    throw new Error(`Invalid decimal: ${value}`)
  }

  const [, sign, integer, fraction = ''] = match
  const magnitude = BigInt(`${integer}${fraction}`)

  return {
    coefficient: sign === '-' ? -magnitude : magnitude,
    scale: fraction.length
  }
}

const renderDecimal = ({ coefficient, scale }: ParsedDecimal): string => {
  const negative = coefficient < 0n
  const digits = (negative ? -coefficient : coefficient)
    .toString()
    .padStart(scale + 1, '0')
  const integer = scale === 0 ? digits : digits.slice(0, -scale)
  const fraction = scale === 0 ? '' : digits.slice(-scale).replace(/0+$/, '')
  const unsigned = fraction ? `${integer}.${fraction}` : integer

  return coefficient === 0n ? '0' : `${negative ? '-' : ''}${unsigned}`
}

export const normalizeDecimal = (value: string): string =>
  renderDecimal(parseDecimal(value))

export const subtractDecimals = (
  currentValue: string,
  previousValue: string
): string => {
  const current = parseDecimal(currentValue)
  const previous = parseDecimal(previousValue)
  const scale = Math.max(current.scale, previous.scale)
  const currentCoefficient =
    current.coefficient * 10n ** BigInt(scale - current.scale)
  const previousCoefficient =
    previous.coefficient * 10n ** BigInt(scale - previous.scale)

  return renderDecimal({
    coefficient: currentCoefficient - previousCoefficient,
    scale
  })
}

const roundToScale = (
  value: ParsedDecimal,
  maximumScale: number
): ParsedDecimal => {
  if (value.scale <= maximumScale) {
    return value
  }

  const factor = 10n ** BigInt(value.scale - maximumScale)
  const negative = value.coefficient < 0n
  const magnitude = negative ? -value.coefficient : value.coefficient
  const quotient = magnitude / factor
  const remainder = magnitude % factor
  const rounded = quotient + (remainder * 2n >= factor ? 1n : 0n)

  return {
    coefficient: negative ? -rounded : rounded,
    scale: maximumScale
  }
}

export const formatSignedChange = (value: string): string => {
  const normalized = renderDecimal(roundToScale(parseDecimal(value), 2))
  return normalized === '0' || normalized.startsWith('-')
    ? normalized
    : `+${normalized}`
}
```

- [ ] **Step 4: Run decimal tests and verify GREEN**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/decimal.test.ts
```

Expected: all decimal tests pass.

- [ ] **Step 5: Write failing mixed-direction formatting tests**

Replace the upward formatting expectation in `src/__tests__/format.test.ts`
with a mixed-direction case:

```ts
it('should preserve each currency change direction', () => {
  const currenciesMap: CurrenciesMap = {
    USD: { amount: '450', change: '1.5' },
    EUR: { amount: '480', change: '-2.25' },
    RUB: { amount: '5', change: '0.01' }
  }

  const result = formatText(mockText, currenciesMap)

  expect(result).toBe('USD: 450 (+1.5), EUR: 480 (-2.25), RUB: 5 (+0.01)')
})
```

Update `mockText` so `up` and `down` both use sign-neutral placeholders:

```ts
const mockText = {
  up: 'USD: {RATE_USD} ({RATE_CHANGE_USD}), EUR: {RATE_EUR} ({RATE_CHANGE_EUR}), RUB: {RATE_RUB} ({RATE_CHANGE_RUB})',
  down: 'USD: {RATE_USD} ({RATE_CHANGE_USD}), EUR: {RATE_EUR} ({RATE_CHANGE_EUR}), RUB: {RATE_RUB} ({RATE_CHANGE_RUB})',
  no_change: 'USD: {RATE_USD}, EUR: {RATE_EUR}, RUB: {RATE_RUB}'
}
```

Update the remaining literal expectations to:

```ts
expect(downwardResult).toBe(
  'USD: 450 (-1.5), EUR: 480 (-2), RUB: 5 (0)'
)
expect(noChangeResult).toBe('USD: 450, EUR: 480, RUB: 5')
expect(invalidChangeResult).toBe('USD: 450, EUR: 480, RUB: 5')
expect(usdPrimaryResult).toBe(
  'USD: 450 (+1.5), EUR: 480 (-2), RUB: 5 (0)'
)
expect(nonUsdFallbackResult).toBe(
  'USD: 450 (0), EUR: 480 (+2), RUB: 5 (0)'
)
```

Use these names for the corresponding existing `result` variables or keep
`result` inside each separate test; the asserted strings must remain literal.

- [ ] **Step 6: Run format tests and verify RED**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/format.test.ts
```

Expected: FAIL because `formatText` currently applies an absolute one-decimal
value and the template's shared direction.

- [ ] **Step 7: Render signed values in code and neutralize locale templates**

In `src/format.ts`, import `formatSignedChange` and replace the three
`formatNumber` calls with it. Remove the obsolete `formatNumber` helper.

In both locale JSON files, change every change expression from:

```text
(+{RATE_CHANGE_USD})
(-{RATE_CHANGE_USD})
```

to:

```text
({RATE_CHANGE_USD})
```

Apply the same replacement for EUR and RUB. Keep the existing `up`, `down`, and
`no_change` prose.

- [ ] **Step 8: Run focused and full tests**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/decimal.test.ts src/__tests__/format.test.ts
rtk npm run typecheck
rtk npm run lint
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit exact formatting**

```bash
rtk git add src/decimal.ts src/format.ts src/locales/ru.json src/locales/kk.json src/__tests__/decimal.test.ts src/__tests__/format.test.ts
rtk git commit -m "fix(format): preserve currency change signs"
```

---

### Task 3: SQLite History Repository and Snapshot Domain

**Files:**
- Create: `src/rates.ts`
- Create: `src/history.ts`
- Create: `src/__tests__/rates.test.ts`
- Create: `src/__tests__/history.test.ts`
- Modify: `src/types.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `CurrencyCode = 'USD' | 'EUR' | 'RUB'`.
- Produces: `StoredRate { amount: string; rssChange: string }`.
- Produces: `RateSnapshot { rateDate: string; rates: Record<CurrencyCode, StoredRate> }`.
- Produces: `createRateSnapshot(rates: Rates): RateSnapshot`.
- Produces: `createCurrenciesMap(current: RateSnapshot, previous: RateSnapshot | null): CurrenciesMap`.
- Produces: `findChangeMismatches(current: RateSnapshot, calculated: CurrenciesMap): ChangeMismatch[]`.
- Produces: `RateHistory` with `findPreviousSnapshot`, `saveSnapshot`, and `close`.

- [ ] **Step 1: Write failing snapshot-domain tests**

Create `src/__tests__/rates.test.ts` with literal `Rates` fixtures covering:

```ts
import {
  createCurrenciesMap,
  createRateSnapshot
} from '../rates'
import { Rate, RateSnapshot, Rates } from '../types'

const rate = (
  title: string,
  description: string,
  change: string,
  pubDate = '28.07.2026'
): Rate => ({
  title,
  pubDate,
  description,
  quant: '1',
  index: change.startsWith('-') ? 'DOWN' : 'UP',
  change,
  link: ''
})

const mockRates: Rates = [
  rate('USD', '473.4', '-2.67'),
  rate('EUR', '539.39', '-2.47'),
  rate('RUB', '6.07', '-0.01')
]

const currentSnapshot: RateSnapshot = {
  rateDate: '2026-07-28',
  rates: {
    USD: { amount: '450.00', rssChange: '+1.50' },
    EUR: { amount: '480.00', rssChange: '-2.25' },
    RUB: { amount: '5.00', rssChange: '-0.10' }
  }
}

const previousSnapshot: RateSnapshot = {
  rateDate: '2026-07-27',
  rates: {
    USD: { amount: '448.50', rssChange: '-1' },
    EUR: { amount: '482.25', rssChange: '-1' },
    RUB: { amount: '5.10', rssChange: '-1' }
  }
}

it('creates a complete ISO-dated snapshot', () => {
  expect(createRateSnapshot(mockRates)).toEqual({
    rateDate: '2026-07-28',
    rates: {
      USD: { amount: '473.4', rssChange: '-2.67' },
      EUR: { amount: '539.39', rssChange: '-2.47' },
      RUB: { amount: '6.07', rssChange: '-0.01' }
    }
  })
})

it.each([
  ['missing currency', mockRates.slice(0, 2)],
  ['missing change', mockRates.map(rate =>
    rate.title === 'USD' ? { ...rate, change: '' } : rate
  )],
  ['mixed dates', mockRates.map(rate =>
    rate.title === 'RUB' ? { ...rate, pubDate: '29.07.2026' } : rate
  )]
])('rejects %s', (_name, rates) => {
  expect(() => createRateSnapshot(rates)).toThrow()
})

it('calculates changes against a previous snapshot', () => {
  expect(createCurrenciesMap(currentSnapshot, previousSnapshot)).toEqual({
    USD: { amount: '450.00', change: '1.5' },
    EUR: { amount: '480.00', change: '-2.25' },
    RUB: { amount: '5.00', change: '-0.1' }
  })
})

it('uses RSS changes when there is no previous snapshot', () => {
  expect(createCurrenciesMap(currentSnapshot, null)).toEqual({
    USD: { amount: '450.00', change: '+1.50' },
    EUR: { amount: '480.00', change: '-2.25' },
    RUB: { amount: '5.00', change: '-0.10' }
  })
})
```

- [ ] **Step 2: Run snapshot tests and verify RED**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/rates.test.ts
```

Expected: FAIL because `src/rates.ts` does not exist.

- [ ] **Step 3: Align Node.js types and runtime metadata**

Run:

```bash
rtk npm install --save-dev @types/node@^22.0.0
```

Add to `package.json`:

```json
"engines": {
"node": ">=22.13.0"
}
```

Do not add a runtime SQLite package.

- [ ] **Step 4: Add snapshot domain types**

Append to `src/types.ts`:

```ts
export type CurrencyCode = 'USD' | 'EUR' | 'RUB'

export interface StoredRate {
  amount: string
  rssChange: string
}

export interface RateSnapshot {
  rateDate: string
  rates: Record<CurrencyCode, StoredRate>
}

export interface ChangeMismatch {
  currency: CurrencyCode
  calculated: string
  rss: string
}
```

Make `CurrenciesMap` use `Record<CurrencyCode, Currency>` while keeping the
public shape unchanged.

- [ ] **Step 5: Implement snapshot validation and change calculation**

Create `src/rates.ts` with:

```ts
const CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'RUB']
const RSS_DATE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})$/

const normalizeRateDate = (value: string): string => {
  const match = RSS_DATE_PATTERN.exec(value.trim())
  if (!match) {
    throw new Error(`Invalid publication date: ${value}`)
  }

  const [, dayText, monthText, yearText] = match
  const day = Number(dayText)
  const month = Number(monthText)
  const year = Number(yearText)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid publication date: ${value}`)
  }

  return `${yearText}-${monthText}-${dayText}`
}

export const createRateSnapshot = (rates: Rates): RateSnapshot => {
  const entries = CURRENCIES.map(currency => {
    const matches = rates.filter(rate => rate.title === currency)
    if (matches.length !== 1) {
      throw new Error(`Expected exactly one ${currency} rate`)
    }

    const [rate] = matches
    normalizeDecimal(rate.description)
    normalizeDecimal(rate.change)

    return {
      currency,
      date: normalizeRateDate(rate.pubDate),
      rate: {
        amount: rate.description.trim(),
        rssChange: rate.change.trim()
      }
    }
  })

  const dates = new Set(entries.map(entry => entry.date))
  if (dates.size !== 1) {
    throw new Error('Monitored currency publication dates do not match')
  }

  return {
    rateDate: entries[0].date,
    rates: Object.fromEntries(
      entries.map(entry => [entry.currency, entry.rate])
    ) as Record<CurrencyCode, StoredRate>
  }
}

export const createCurrenciesMap = (
  current: RateSnapshot,
  previous: RateSnapshot | null
): CurrenciesMap =>
  Object.fromEntries(
    CURRENCIES.map(currency => [
      currency,
      {
        amount: current.rates[currency].amount,
        change: previous
          ? subtractDecimals(
              current.rates[currency].amount,
              previous.rates[currency].amount
            )
          : current.rates[currency].rssChange
      }
    ])
  ) as CurrenciesMap

export const findChangeMismatches = (
  current: RateSnapshot,
  calculated: CurrenciesMap
): ChangeMismatch[] =>
  CURRENCIES.flatMap(currency => {
    const rss = normalizeDecimal(current.rates[currency].rssChange)
    const value = normalizeDecimal(calculated[currency].change)
    return rss === value ? [] : [{ currency, calculated: value, rss }]
  })
```

- [ ] **Step 6: Run snapshot tests and verify GREEN**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/rates.test.ts
```

Expected: all snapshot-domain tests pass.

- [ ] **Step 7: Write failing real SQLite repository tests**

Create `src/__tests__/history.test.ts` using `new RateHistory(':memory:')` and
real SQL:

```ts
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DatabaseSync } from 'node:sqlite'

import { RateHistory } from '../history'
import { RateSnapshot } from '../types'

const snapshot20260727: RateSnapshot = {
  rateDate: '2026-07-27',
  rates: {
    USD: { amount: '448.50', rssChange: '-1' },
    EUR: { amount: '482.25', rssChange: '-1' },
    RUB: { amount: '5.10', rssChange: '-1' }
  }
}

const snapshot20260728: RateSnapshot = {
  rateDate: '2026-07-28',
  rates: {
    USD: { amount: '450.00', rssChange: '1.5' },
    EUR: { amount: '480.00', rssChange: '-2.25' },
    RUB: { amount: '5.00', rssChange: '-0.1' }
  }
}

const correctedSnapshot20260728: RateSnapshot = {
  rateDate: '2026-07-28',
  rates: {
    USD: { amount: '450.10', rssChange: '1.6' },
    EUR: { amount: '480.20', rssChange: '-2.05' },
    RUB: { amount: '5.01', rssChange: '-0.09' }
  }
}

describe('RateHistory', () => {
  let history: RateHistory

  beforeEach(() => {
    history = new RateHistory(':memory:')
  })

  afterEach(() => {
    history.close()
  })

  it('returns null before any earlier snapshot exists', () => {
    expect(history.findPreviousSnapshot('2026-07-28')).toBeNull()
  })

  it('returns the latest complete earlier snapshot', () => {
    history.saveSnapshot(snapshot20260727)
    history.saveSnapshot(snapshot20260728)

    expect(history.findPreviousSnapshot('2026-07-29')).toEqual(snapshot20260728)
  })

  it('excludes the current date when a date is processed again', () => {
    history.saveSnapshot(snapshot20260727)
    history.saveSnapshot(snapshot20260728)

    expect(history.findPreviousSnapshot('2026-07-28')).toEqual(snapshot20260727)
  })

  it('upserts corrections without duplicate currency rows', () => {
    history.saveSnapshot(snapshot20260728)
    history.saveSnapshot(correctedSnapshot20260728)

    expect(history.findPreviousSnapshot('2026-07-29')).toEqual(
      correctedSnapshot20260728
    )
  })
})

describe('RateHistory transaction boundaries', () => {
  let directory: string
  let databasePath: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'kzt-history-'))
    databasePath = join(directory, 'rates.sqlite')
  })

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true })
  })

  it('ignores a date that does not contain all currencies', () => {
    const initialized = new RateHistory(databasePath)
    initialized.close()
    const database = new DatabaseSync(databasePath)
    const insert = database.prepare(`
      INSERT INTO rate_history (
        rate_date, currency, amount, rss_change, fetched_at
      ) VALUES (?, ?, ?, ?, ?)
    `)
    insert.run('2026-07-28', 'USD', '450.00', '1.5', '2026-07-28T00:00:00Z')
    insert.run('2026-07-28', 'EUR', '480.00', '-2.25', '2026-07-28T00:00:00Z')
    database.close()

    const history = new RateHistory(databasePath)
    expect(history.findPreviousSnapshot('2026-07-29')).toBeNull()
    history.close()
  })

  it('rolls back every currency when one insert fails', () => {
    const initialized = new RateHistory(databasePath)
    initialized.close()
    const database = new DatabaseSync(databasePath)
    database.exec(`
      CREATE TRIGGER fail_eur
      BEFORE INSERT ON rate_history
      WHEN NEW.currency = 'EUR'
      BEGIN
        SELECT RAISE(ABORT, 'forced EUR failure');
      END
    `)
    database.close()

    const history = new RateHistory(databasePath)
    expect(() => history.saveSnapshot(snapshot20260728)).toThrow(
      'forced EUR failure'
    )
    history.close()

    const inspection = new DatabaseSync(databasePath)
    const row = inspection
      .prepare('SELECT COUNT(*) AS count FROM rate_history')
      .get() as { count: number }
    inspection.close()
    expect(row.count).toBe(0)
  })
})
```

The expected snapshots above remain literal and do not reuse production
builders.

- [ ] **Step 8: Run history tests and verify RED**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/history.test.ts
```

Expected: FAIL because `src/history.ts` does not exist.

- [ ] **Step 9: Implement the SQLite repository**

Create `src/history.ts`:

```ts
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { DatabaseSync } from 'node:sqlite'

import { CurrencyCode, RateSnapshot, StoredRate } from './types'

const CURRENCIES: CurrencyCode[] = ['USD', 'EUR', 'RUB']

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS rate_history (
    rate_date TEXT NOT NULL,
    currency TEXT NOT NULL
      CHECK (currency IN ('USD', 'EUR', 'RUB')),
    amount TEXT NOT NULL,
    rss_change TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (rate_date, currency)
  ) STRICT
`

const defaultDatabasePath = () =>
  process.env.KZT_RATES_DB_FILE ||
  join(process.cwd(), 'data', 'rates.sqlite')

export class RateHistory {
  private readonly database: DatabaseSync

  constructor(path = defaultDatabasePath()) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true })
    }
    this.database = new DatabaseSync(path)
    this.database.exec(SCHEMA)
  }

  findPreviousSnapshot(beforeDate: string): RateSnapshot | null {
    const dateRow = this.database
      .prepare(`
        SELECT rate_date
        FROM rate_history
        WHERE rate_date < ?
        GROUP BY rate_date
        HAVING COUNT(*) = 3
        ORDER BY rate_date DESC
        LIMIT 1
      `)
      .get(beforeDate) as { rate_date: string } | undefined

    if (!dateRow) {
      return null
    }

    const rows = this.database
      .prepare(`
        SELECT currency, amount, rss_change
        FROM rate_history
        WHERE rate_date = ?
        ORDER BY currency
      `)
      .all(dateRow.rate_date) as Array<{
        currency: string
        amount: string
        rss_change: string
      }>
    const rates: Partial<Record<CurrencyCode, StoredRate>> = {}

    for (const row of rows) {
      if (!CURRENCIES.includes(row.currency as CurrencyCode)) {
        throw new Error(`Unexpected stored currency: ${row.currency}`)
      }
      rates[row.currency as CurrencyCode] = {
        amount: row.amount,
        rssChange: row.rss_change
      }
    }

    if (CURRENCIES.some(currency => !rates[currency])) {
      throw new Error(`Incomplete stored snapshot: ${dateRow.rate_date}`)
    }

    return {
      rateDate: dateRow.rate_date,
      rates: rates as Record<CurrencyCode, StoredRate>
    }
  }

  saveSnapshot(snapshot: RateSnapshot): void {
    const statement = this.database.prepare(`
      INSERT INTO rate_history (
        rate_date, currency, amount, rss_change, fetched_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (rate_date, currency) DO UPDATE SET
        amount = excluded.amount,
        rss_change = excluded.rss_change,
        fetched_at = excluded.fetched_at
    `)
    const fetchedAt = new Date().toISOString()

    this.database.exec('BEGIN IMMEDIATE')
    try {
      for (const currency of CURRENCIES) {
        const rate = snapshot.rates[currency]
        statement.run(
          snapshot.rateDate,
          currency,
          rate.amount,
          rate.rssChange,
          fetchedAt
        )
      }
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  close(): void {
    this.database.close()
  }
}
```

Use this exact previous-date query:

```sql
SELECT rate_date
FROM rate_history
WHERE rate_date < ?
GROUP BY rate_date
HAVING COUNT(*) = 3
ORDER BY rate_date DESC
LIMIT 1
```

Then query:

```sql
SELECT currency, amount, rss_change
FROM rate_history
WHERE rate_date = ?
ORDER BY currency
```

- [ ] **Step 10: Run repository and project checks**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/rates.test.ts src/__tests__/history.test.ts
rtk npm run typecheck
rtk npm run lint
```

Expected: all commands exit 0. Node.js 22 may emit one expected
`ExperimentalWarning` for `node:sqlite`; do not suppress unrelated process
warnings globally.

- [ ] **Step 11: Commit SQLite history**

```bash
rtk git add package.json package-lock.json src/types.ts src/rates.ts src/history.ts src/__tests__/rates.test.ts src/__tests__/history.test.ts
rtk git commit -m "feat(storage): persist sqlite rate history"
```

---

### Task 4: Integrate History Into the Publication Flow

**Files:**
- Modify: `src/index.ts`
- Modify: `src/__tests__/integration.test.ts`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `README.md`
- Delete: `src/state.ts`

**Interfaces:**
- Consumes: `RateHistory`.
- Consumes: `createRateSnapshot`, `createCurrenciesMap`, and `findChangeMismatches`.
- Preserves: `processRates(): Promise<void>` and existing Twitter publication order.
- Replaces: JSON `loadRateSnapshot`, `applySnapshotChanges`, and `saveRateSnapshot`.

- [ ] **Step 1: Replace JSON integration tests with SQLite scenarios**

Delete the JSON path tests and filesystem JSON assertions previously added to
`src/__tests__/integration.test.ts`. Give each test a temporary SQLite path via
`KZT_RATES_DB_FILE`.

Add a helper:

```ts
import { RateHistory } from '../history'
import { RateSnapshot, Rates } from '../types'

const createTemporaryDatabasePath = () => {
  const directory = mkdtempSync(join(tmpdir(), 'kzt-course-'))
  return {
    directory,
    database: join(directory, 'rates.sqlite')
  }
}

const priorSnapshot: RateSnapshot = {
  rateDate: '2026-07-27',
  rates: {
    USD: { amount: '448.50', rssChange: '-1' },
    EUR: { amount: '482.25', rssChange: '-1' },
    RUB: { amount: '5.10', rssChange: '-1' }
  }
}

const currentSnapshot: RateSnapshot = {
  rateDate: '2026-07-28',
  rates: {
    USD: { amount: '450.00', rssChange: '9' },
    EUR: { amount: '480.00', rssChange: '9' },
    RUB: { amount: '5.00', rssChange: '9' }
  }
}

const currentRates: Rates = [
  {
    title: 'USD',
    pubDate: '28.07.2026',
    description: '450.00',
    quant: '1',
    index: 'UP',
    change: '9',
    link: ''
  },
  {
    title: 'EUR',
    pubDate: '28.07.2026',
    description: '480.00',
    quant: '1',
    index: 'DOWN',
    change: '9',
    link: ''
  },
  {
    title: 'RUB',
    pubDate: '28.07.2026',
    description: '5.00',
    quant: '1',
    index: 'DOWN',
    change: '9',
    link: ''
  }
]
```

Extend the console harness to save, mock, and restore `console.warn`.

Add these behavioral cases:

```ts
it('uses RSS changes and stores history on the first date', async () => {
  const { directory, database } = createTemporaryDatabasePath()

  try {
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules({ KZT_RATES_DB_FILE: database })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(currentRates)
    getMonitoredRates.mockReturnValue(currentRates)
    formatText.mockReturnValue('Mock tweet text')

    await processRates()

    expect(formatText).toHaveBeenCalledWith(expect.anything(), {
      USD: { amount: '450.00', change: '9' },
      EUR: { amount: '480.00', change: '9' },
      RUB: { amount: '5.00', change: '9' }
    })

    const history = new RateHistory(database)
    try {
      expect(history.findPreviousSnapshot('2026-07-29')).toEqual(
        currentSnapshot
      )
    } finally {
      history.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('calculates changes from the prior complete date', async () => {
  const { directory, database } = createTemporaryDatabasePath()
  const seedHistory = new RateHistory(database)
  seedHistory.saveSnapshot(priorSnapshot)
  seedHistory.close()

  try {
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules({ KZT_RATES_DB_FILE: database })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(currentRates)
    getMonitoredRates.mockReturnValue(currentRates)
    formatText.mockReturnValue('Mock tweet text')

    await processRates()

    expect(formatText).toHaveBeenCalledWith(expect.anything(), {
      USD: { amount: '450.00', change: '1.5' },
      EUR: { amount: '480.00', change: '-2.25' },
      RUB: { amount: '5.00', change: '-0.1' }
    })
    expect(console.warn).toHaveBeenCalledTimes(3)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('reprocessing one date still compares with the earlier date', async () => {
  const { directory, database } = createTemporaryDatabasePath()
  const seedHistory = new RateHistory(database)
  seedHistory.saveSnapshot(priorSnapshot)
  seedHistory.saveSnapshot(currentSnapshot)
  seedHistory.close()

  try {
    const {
      processRates,
      getRSS,
      parseXml,
      getMonitoredRates,
      formatText
    } = await loadModules({ KZT_RATES_DB_FILE: database })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(currentRates)
    getMonitoredRates.mockReturnValue(currentRates)
    formatText.mockReturnValue('Mock tweet text')

    await processRates()

    expect(formatText).toHaveBeenCalledWith(expect.anything(), {
      USD: { amount: '450.00', change: '1.5' },
      EUR: { amount: '480.00', change: '-2.25' },
      RUB: { amount: '5.00', change: '-0.1' }
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('stores history before a Twitter publication failure', async () => {
  const { directory, database } = createTemporaryDatabasePath()

  try {
    const { processRates, getRSS, parseXml, getMonitoredRates, formatText } =
      await loadModules({
        NODE_ENV: 'production',
        DEBUG: 'false',
        KZT_RATES_DB_FILE: database,
        ...fullTwitterCredentials
      })
    getRSS.mockResolvedValue('mock xml')
    parseXml.mockResolvedValue(currentRates)
    getMonitoredRates.mockReturnValue(currentRates)
    formatText.mockReturnValue('Mock tweet text')
    mockTweet.mockRejectedValue(new Error('twitter unavailable'))

    await expect(processRates()).rejects.toThrow('twitter unavailable')

    const history = new RateHistory(database)
    try {
      expect(history.findPreviousSnapshot('2026-07-29')).toEqual(
        currentSnapshot
      )
    } finally {
      history.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
```

Continue mocking RSS parsing/fetch and Twitter. Keep the existing `formatText`
boundary mock for literal `CurrenciesMap` assertions; Task 2 exercises the real
formatter. Use the real history, snapshot, and decimal modules.

- [ ] **Step 2: Run integration tests and verify RED**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/integration.test.ts
```

Expected: the SQLite scenarios fail because `processRates` still imports the
JSON snapshot functions and saves after publication.

- [ ] **Step 3: Refactor tweet generation to accept a completed map**

Change:

```ts
const generateTweet = (rates: Rates)
```

to:

```ts
const generateTweet = (currenciesMap: CurrenciesMap)
```

Keep only locale formatting in this function. Currency completeness moves to
`createRateSnapshot`.

- [ ] **Step 4: Coordinate SQLite history in `processRates`**

Use this order:

```ts
const monitoredRates = getMonitoredRates(parsedRates)
const currentSnapshot = createRateSnapshot(monitoredRates)
const history = new RateHistory()

try {
  const previousSnapshot = history.findPreviousSnapshot(
    currentSnapshot.rateDate
  )
  const currenciesMap = createCurrenciesMap(
    currentSnapshot,
    previousSnapshot
  )

  if (previousSnapshot) {
    for (const mismatch of findChangeMismatches(
      currentSnapshot,
      currenciesMap
    )) {
      console.warn('RSS change differs from calculated history', {
        date: currentSnapshot.rateDate,
        ...mismatch
      })
    }
  }

  history.saveSnapshot(currentSnapshot)

  const { tweetKK, tweetRU } = generateTweet(currenciesMap)

  const shouldPublish =
    process.env.FORCE_UPDATE === 'true' ||
    process.env.NODE_ENV === 'production'

  if (shouldPublish) {
    await sendTweet(tweetKK)
    await sendTweet(tweetRU)
  } else if (process.env.NODE_ENV !== 'test') {
    console.log('🚀 ~ tweetKK, tweetRU', { tweetKK, tweetRU })
  }
} finally {
  history.close()
}
```

Keep the outer production error behavior. Ensure development `process.exit()`
runs only after the database connection is closed.

- [ ] **Step 5: Delete the JSON state implementation**

Delete `src/state.ts` and remove all imports of:

```ts
loadRateSnapshot
applySnapshotChanges
saveRateSnapshot
```

Confirm no references remain:

```bash
rtk rg -n 'KZT_RATES_STATE_FILE|loadRateSnapshot|applySnapshotChanges|saveRateSnapshot' .
```

Expected: no matches.

- [ ] **Step 6: Update runtime configuration and documentation**

In `.env.example`, replace:

```env
KZT_RATES_STATE_FILE=
```

with:

```env
KZT_RATES_DB_FILE=
```

Keep `/data/` in `.gitignore`; it covers `rates.sqlite`, `rates.sqlite-wal`,
and `rates.sqlite-shm`.

Update `README.md` to state:

- history lives in `data/rates.sqlite` by default;
- production can set `KZT_RATES_DB_FILE` to an absolute persistent path;
- the first stored date uses RSS `<change>`;
- later dates calculate changes from the latest complete earlier snapshot;
- runtime requires Node.js 22.13.0+.

- [ ] **Step 7: Run focused integration verification**

Run:

```bash
rtk npm test -- --runInBand src/__tests__/integration.test.ts
```

Expected: all integration tests pass, including first date, sequential dates,
same-date retry, and Twitter failure persistence.

- [ ] **Step 8: Run the complete verification suite**

Run each command separately:

```bash
rtk npm test -- --runInBand
rtk npm run typecheck
rtk npm run lint
rtk git diff --check
```

Expected:

- all Jest suites pass with zero failures;
- TypeScript exits 0;
- ESLint exits 0 with no errors;
- Git whitespace check exits 0.

- [ ] **Step 9: Perform a local no-publish smoke test**

Remove only the known smoke-test database paths, then explicitly enable debug
logging:

```bash
rtk rm -f /tmp/kzt-course-smoke-rates.sqlite /tmp/kzt-course-smoke-rates.sqlite-wal /tmp/kzt-course-smoke-rates.sqlite-shm
rtk proxy env KZT_RATES_DB_FILE=/tmp/kzt-course-smoke-rates.sqlite DEBUG=true NODE_ENV=development npm start
```

Expected:

- live RSS parsing produces USD, EUR, and RUB;
- composed Kazakh and Russian texts are logged rather than posted;
- the temporary SQLite database is created;
- the process exits normally.

Do not use production credentials or `FORCE_UPDATE=true` for this smoke test.

- [ ] **Step 10: Commit the integrated behavior**

```bash
rtk git add .env.example .gitignore README.md src/index.ts src/__tests__/integration.test.ts
rtk git commit -m "feat(bot): calculate changes from history"
```

---

## Post-Implementation Server Check

Do not mutate production as part of local implementation. After the code is
merged and the existing deploy workflow completes, use read-only checks:

```bash
rtk ssh root@s.drugoi.xyz '/root/.nvm/versions/node/v22.22.2/bin/pm2 describe kzt-course'
rtk ssh root@s.drugoi.xyz 'ls -la /root/projects/kzt-course/data'
rtk ssh root@s.drugoi.xyz 'tail -n 100 /root/.pm2/logs/kzt-course-out.log'
rtk ssh root@s.drugoi.xyz 'tail -n 100 /root/.pm2/logs/kzt-course-error.log'
```

Expected after the first valid scheduled run:

- PM2 status is `online`;
- `/root/projects/kzt-course/data/rates.sqlite` exists;
- logs contain composed/publication activity and no SQLite transaction error;
- Node.js 22 may log one `ExperimentalWarning` when `node:sqlite` first loads.
