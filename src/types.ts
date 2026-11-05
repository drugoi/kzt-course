interface Currency {
  amount: string
  change: string
}

export type CurrencyCode = 'USD' | 'EUR' | 'RUB' | 'CNY'

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
  rates: Record<Exclude<CurrencyCode, 'CNY'>, StoredRate> & Partial<Pick<Record<CurrencyCode, StoredRate>, 'CNY'>>
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
