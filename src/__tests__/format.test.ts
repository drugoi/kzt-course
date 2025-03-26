import { formatText } from '../format'
import { CurrenciesMap } from '../types'

describe('formatText', () => {
  const mockText = {
    up: 'USD: {RATE_USD} (+{RATE_CHANGE_USD}), EUR: {RATE_EUR} (+{RATE_CHANGE_EUR})',
    down: 'USD: {RATE_USD} (-{RATE_CHANGE_USD}), EUR: {RATE_EUR} (-{RATE_CHANGE_EUR})',
    no_change: 'USD: {RATE_USD}, EUR: {RATE_EUR}'
  }

  it('should format text for upward trend', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '1.5' },
      EUR: { amount: '480', change: '2.0' },
      RUB: { amount: '5', change: '0' }
    }

    const result = formatText(mockText, currenciesMap)
    expect(result).toBe('USD: 450 (+1.5), EUR: 480 (+2.0)')
  })

  it('should format text for downward trend', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '-1.5' },
      EUR: { amount: '480', change: '-2.0' },
      RUB: { amount: '5', change: '0' }
    }

    const result = formatText(mockText, currenciesMap)
    expect(result).toBe('USD: 450 (-1.5), EUR: 480 (-2.0)')
  })

  it('should format text for no change', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '0' },
      EUR: { amount: '480', change: '0' },
      RUB: { amount: '5', change: '0' }
    }

    const result = formatText(mockText, currenciesMap)
    expect(result).toBe('USD: 450, EUR: 480')
  })

  it('should handle invalid change values', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: 'invalid' },
      EUR: { amount: '480', change: '0' },
      RUB: { amount: '5', change: '0' }
    }

    const result = formatText(mockText, currenciesMap)
    expect(result).toBe('USD: 450, EUR: 480')
  })

  it('should use USD as primary indicator for trend', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '1.5' },
      EUR: { amount: '480', change: '-2.0' },
      RUB: { amount: '5', change: '0' }
    }

    const result = formatText(mockText, currenciesMap)
    expect(result).toBe('USD: 450 (+1.5), EUR: 480 (+2.0)')
  })

  it('should check other currencies when USD has no change', () => {
    const currenciesMap: CurrenciesMap = {
      USD: { amount: '450', change: '0' },
      EUR: { amount: '480', change: '2.0' },
      RUB: { amount: '5', change: '0' }
    }

    const result = formatText(mockText, currenciesMap)
    expect(result).toBe('USD: 450 (+0.0), EUR: 480 (+2.0)')
  })
})
