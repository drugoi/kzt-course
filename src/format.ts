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
  const cnyDirection = determineChangeDirection(currenciesMap.CNY.change)

  if (eurDirection === 'up' || rubDirection === 'up' || cnyDirection === 'up') return 'up'
  if (eurDirection === 'down' || rubDirection === 'down' || cnyDirection === 'down') return 'down'
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
    .replace('{RATE_CNY}', currenciesMap.CNY.amount)

  if (changeDirection !== 'no_change') {
    result = result
      .replace('{RATE_CHANGE_USD}', formatSignedChange(currenciesMap.USD.change))
      .replace('{RATE_CHANGE_RUB}', formatSignedChange(currenciesMap.RUB.change))
      .replace('{RATE_CHANGE_EUR}', formatSignedChange(currenciesMap.EUR.change))
  }

  for (const currency of ['USD', 'EUR', 'RUB', 'CNY'] as const) {
    const change = currenciesMap[currency].change
    const direction = determineChangeDirection(change)
    const symbol = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '–'
    let signedChange = '0'
    try { signedChange = formatSignedChange(change) } catch {}
    result = result
      .replace(`{SIGNED_CHANGE_${currency}}`, signedChange)
      .replace(`{DIRECTION_${currency}}`, symbol)
  }

  return result
}
