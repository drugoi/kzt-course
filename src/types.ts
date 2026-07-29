interface Currency {
  amount: string
  change: string
}

export interface CurrenciesMap {
  USD: Currency
  RUB: Currency
  EUR: Currency
}

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
