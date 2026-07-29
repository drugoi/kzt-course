import { normalizeDecimal, subtractDecimals } from './decimal'
import {
  ChangeMismatch,
  CurrenciesMap,
  CurrencyCode,
  RateSnapshot,
  Rates,
  StoredRate
} from './types'

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
