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
