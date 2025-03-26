interface Currency {
  amount: string
  change: string
}

export interface CurrenciesMap {
  USD: Currency
  RUB: Currency
  EUR: Currency
}

interface Rate {
  title: string
  pubDate: string
  description: string
  quant: string
  index: any
  change: string
  link: any
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
