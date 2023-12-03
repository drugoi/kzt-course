import { CurrenciesMap } from './types'

export const formatText = (text: string, currenciesMap: CurrenciesMap) => {
  return text
    .replace('{RATE_USD}', currenciesMap.USD.amount)
    .replace('{RATE_CHANGE_USD}', currenciesMap.USD.change)
    .replace('{RATE_RUB}', currenciesMap.RUB.amount)
    .replace('{RATE_CHANGE_RUB}', currenciesMap.RUB.change)
    .replace('{RATE_EUR}', currenciesMap.EUR.amount)
    .replace('{RATE_CHANGE_EUR}', currenciesMap.EUR.change)
}
