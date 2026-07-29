import { CurrenciesMap, ChangeDirection, LocaleText } from './types'
import { formatSignedChange, normalizeDecimal } from './decimal'

const determineChangeDirection = (change: string): ChangeDirection => {
  try {
    const normalizedChange = normalizeDecimal(change)
    if (normalizedChange === '0') return 'no_change'
    return normalizedChange.startsWith('-') ? 'down' : 'up'
  } catch {
    return 'no_change'
  }
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
      .replace('{RATE_CHANGE_USD}', formatSignedChange(currenciesMap.USD.change))
      .replace('{RATE_CHANGE_RUB}', formatSignedChange(currenciesMap.RUB.change))
      .replace('{RATE_CHANGE_EUR}', formatSignedChange(currenciesMap.EUR.change))
  }

  return result
}
