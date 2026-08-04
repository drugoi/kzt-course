import { XMLParser } from 'fast-xml-parser'
import axios from 'axios'

import { monitoredCurrencies, nationalBankRates } from './config'
import { Rates } from './types'

const toText = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value)

export const getMonitoredRates = (rates: Rates) => {
  return rates.filter(rate => monitoredCurrencies.includes(rate.title))
}

export const parseXml = async (xml: string): Promise<Rates> => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: true,
      numberParseOptions: {
        leadingZeros: false,
        skipLike: /./,
        hex: false
      }
    })
    const parsedJson = parser.parse(xml)
    const rates = parsedJson.rss?.channel?.item || []

    // Handle single item case (when there's only one rate)
    const ratesArray = Array.isArray(rates) ? rates : [rates]

    return ratesArray.map((rate: Record<string, unknown>) => ({
      title: toText(rate?.title),
      pubDate: toText(rate?.pubDate),
      description: toText(rate?.description),
      quant: toText(rate?.quant),
      index: toText(rate?.index),
      change: toText(rate?.change),
      link: toText(rate?.link)
    }))
  } catch {
    throw new Error('Failed to parse XML')
  }
}

export const getRSS = async () => {
  const rates = await axios.get(nationalBankRates, {
    headers: { 'Content-Type': 'text/xml' }
  })

  return rates.data
}
