interface Currency {
  amount: string
  change: string
}

export type CurrencyCode = 'USD' | 'EUR' | 'RUB'

export type CurrenciesMap = Record<CurrencyCode, Currency>

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

export type ChangeDirection = 'up' | 'down' | 'no_change'

export interface LocaleText {
  text: {
    up: string
    down: string
    no_change: string
  }
}

export interface Locales {
  ru: LocaleText
  kk: LocaleText
}
