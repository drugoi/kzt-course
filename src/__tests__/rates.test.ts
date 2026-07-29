import {
  createCurrenciesMap,
  createRateSnapshot
} from '../rates'
import { Rate, RateSnapshot, Rates } from '../types'

const rate = (
  title: string,
  description: string,
  change: string,
  pubDate = '28.07.2026'
): Rate => ({
  title,
  pubDate,
  description,
  quant: '1',
  index: change.startsWith('-') ? 'DOWN' : 'UP',
  change,
  link: ''
})

const mockRates: Rates = [
  rate('USD', '473.4', '-2.67'),
  rate('EUR', '539.39', '-2.47'),
  rate('RUB', '6.07', '-0.01')
]

const currentSnapshot: RateSnapshot = {
  rateDate: '2026-07-28',
  rates: {
    USD: { amount: '450.00', rssChange: '+1.50' },
    EUR: { amount: '480.00', rssChange: '-2.25' },
    RUB: { amount: '5.00', rssChange: '-0.10' }
  }
}

const previousSnapshot: RateSnapshot = {
  rateDate: '2026-07-27',
  rates: {
    USD: { amount: '448.50', rssChange: '-1' },
    EUR: { amount: '482.25', rssChange: '-1' },
    RUB: { amount: '5.10', rssChange: '-1' }
  }
}

it('creates a complete ISO-dated snapshot', () => {
  expect(createRateSnapshot(mockRates)).toEqual({
    rateDate: '2026-07-28',
    rates: {
      USD: { amount: '473.4', rssChange: '-2.67' },
      EUR: { amount: '539.39', rssChange: '-2.47' },
      RUB: { amount: '6.07', rssChange: '-0.01' }
    }
  })
})

it.each([
  ['missing currency', mockRates.slice(0, 2)],
  ['missing change', mockRates.map(rate =>
    rate.title === 'USD' ? { ...rate, change: '' } : rate
  )],
  ['mixed dates', mockRates.map(rate =>
    rate.title === 'RUB' ? { ...rate, pubDate: '29.07.2026' } : rate
  )]
])('rejects %s', (_name, rates) => {
  expect(() => createRateSnapshot(rates)).toThrow()
})

it('calculates changes against a previous snapshot', () => {
  expect(createCurrenciesMap(currentSnapshot, previousSnapshot)).toEqual({
    USD: { amount: '450.00', change: '1.5' },
    EUR: { amount: '480.00', change: '-2.25' },
    RUB: { amount: '5.00', change: '-0.1' }
  })
})

it('uses RSS changes when there is no previous snapshot', () => {
  expect(createCurrenciesMap(currentSnapshot, null)).toEqual({
    USD: { amount: '450.00', change: '+1.50' },
    EUR: { amount: '480.00', change: '-2.25' },
    RUB: { amount: '5.00', change: '-0.10' }
  })
})
