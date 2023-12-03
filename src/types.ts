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
