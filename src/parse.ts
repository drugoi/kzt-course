import { XMLParser } from 'fast-xml-parser'
import axios from 'axios'

import { monitoredCurrencies, nationalBankRates } from './config'
import { Rates } from './types'

export const getMonitoredRates = (rates: Rates) => {
  return rates.filter(rate => monitoredCurrencies.includes(rate.title))
}

export const parseXml = async (xml: string) => {
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

    return ratesArray.map((rate: any) => ({
      ...rate,
      description: rate?.description?.toString() || '0',
      change: rate?.change?.toString() || '0'
    }))
  } catch (error) {
    throw new Error('Failed to parse XML')
  }
}

export const getRSS = async () => {
  const rates = await axios.get(nationalBankRates, {
    headers: { 'Content-Type': 'text/xml' }
  })

  return rates.data
}
