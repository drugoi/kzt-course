import { formatText } from '../format'
import { CurrenciesMap } from '../types'

describe('formatText', () => {
  const mockText = {
    up: 'USD: {RATE_USD} ({RATE_CHANGE_USD}), EUR: {RATE_EUR} ({RATE_CHANGE_EUR}), RUB: {RATE_RUB} ({RATE_CHANGE_RUB})',
    down: 'USD: {RATE_USD} ({RATE_CHANGE_USD}), EUR: {RATE_EUR} ({RATE_CHANGE_EUR}), RUB: {RATE_RUB} ({RATE_CHANGE_RUB})',
    no_change: 'USD: {RATE_USD}, EUR: {RATE_EUR}, RUB: {RATE_RUB}'
  }

  it('should preserve each currency change direction', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '1.5' },
      EUR: { amount: '480', change: '-2.25' },
      RUB: { amount: '5', change: '0.01' }
    }

    const result = formatText(mockText, currenciesMap)
    expect(result).toBe('USD: 450 (+1.5), EUR: 480 (-2.25), RUB: 5 (+0.01)')
  })

  it('should format text for downward trend', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '-1.5' },
      EUR: { amount: '480', change: '-2.0' },
      RUB: { amount: '5', change: '0' }
    }

    const downwardResult = formatText(mockText, currenciesMap)
    expect(downwardResult).toBe(
      'USD: 450 (-1.5), EUR: 480 (-2), RUB: 5 (0)'
    )
  })

  it('should format text for no change', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '0' },
      EUR: { amount: '480', change: '0' },
      RUB: { amount: '5', change: '0' }
    }

    const noChangeResult = formatText(mockText, currenciesMap)
    expect(noChangeResult).toBe('USD: 450, EUR: 480, RUB: 5')
  })

  it('should handle invalid change values', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: 'invalid' },
      EUR: { amount: '480', change: '0' },
      RUB: { amount: '5', change: '0' }
    }

    const invalidChangeResult = formatText(mockText, currenciesMap)
    expect(invalidChangeResult).toBe('USD: 450, EUR: 480, RUB: 5')
  })

  it('should preserve direction for an exact decimal that underflows to zero', () => {
    const directionText = {
      up: 'up',
      down: 'down',
      no_change: 'no change'
    }
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: `0.${'0'.repeat(323)}1` },
      EUR: { amount: '480', change: '0' },
      RUB: { amount: '5', change: '0' }
    }

    expect(formatText(directionText, currenciesMap)).toBe('up')
  })

  it('should use USD as primary indicator for trend', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '1.5' },
      EUR: { amount: '480', change: '-2.0' },
      RUB: { amount: '5', change: '0' }
    }

    const usdPrimaryResult = formatText(mockText, currenciesMap)
    expect(usdPrimaryResult).toBe(
      'USD: 450 (+1.5), EUR: 480 (-2), RUB: 5 (0)'
    )
  })

  it('should check other currencies when USD has no change', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '0' },
      EUR: { amount: '480', change: '2.0' },
      RUB: { amount: '5', change: '0' }
    }

    const nonUsdFallbackResult = formatText(mockText, currenciesMap)
    expect(nonUsdFallbackResult).toBe(
      'USD: 450 (0), EUR: 480 (+2), RUB: 5 (0)'
    )
  })
})
