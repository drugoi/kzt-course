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

  constructor (path = defaultDatabasePath()) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true })
    }
    const database = new DatabaseSync(path)
    try {
      database.exec(SCHEMA)
    } catch (error) {
      database.close()
      throw error
    }
    this.database = database
  }

  findPreviousSnapshot (beforeDate: string): RateSnapshot | null {
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

  saveSnapshot (snapshot: RateSnapshot): void {
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

  close (): void {
    this.database.close()
  }
}
