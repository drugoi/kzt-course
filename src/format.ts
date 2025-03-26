import { CurrenciesMap, ChangeDirection, LocaleText } from './types'

const determineChangeDirection = (change: string): ChangeDirection => {
  const changeValue = parseFloat(change)
  if (isNaN(changeValue)) return 'no_change'
  if (changeValue > 0) return 'up'
  if (changeValue < 0) return 'down'
  return 'no_change'
}

const getChangeDirection = (currenciesMap: CurrenciesMap): ChangeDirection => {
  // Check USD changes as the primary indicator
  const usdDirection = determineChangeDirection(currenciesMap.USD.change)
  if (usdDirection !== 'no_change') {
    return usdDirection
  }

  // If USD has no change, check other currencies
  const eurDirection = determineChangeDirection(currenciesMap.EUR.change)
  const rubDirection = determineChangeDirection(currenciesMap.RUB.change)

  if (eurDirection === 'up' || rubDirection === 'up') return 'up'
  if (eurDirection === 'down' || rubDirection === 'down') return 'down'
  return 'no_change'
}

const formatNumber = (value: string): string => {
  const num = parseFloat(value)
  return Math.abs(num).toFixed(1)
}

export const formatText = (
  text: LocaleText['text'],
  currenciesMap: CurrenciesMap
) => {
  const changeDirection = getChangeDirection(currenciesMap)
  const template = text[changeDirection]

  let result = template
    .replace('{RATE_USD}', currenciesMap.USD.amount)
    .replace('{RATE_RUB}', currenciesMap.RUB.amount)
    .replace('{RATE_EUR}', currenciesMap.EUR.amount)

  if (changeDirection !== 'no_change') {
    result = result
      .replace('{RATE_CHANGE_USD}', formatNumber(currenciesMap.USD.change))
      .replace('{RATE_CHANGE_RUB}', formatNumber(currenciesMap.RUB.change))
      .replace('{RATE_CHANGE_EUR}', formatNumber(currenciesMap.EUR.change))
  }

  return result
}
