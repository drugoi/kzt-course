import parser from 'xml2json'
import axios from 'axios'

import { monitoredCurrencies, nationalBankRates } from './config'
import { Rates } from './types'

export const getMonitoredRates = (rates: Rates) => {
  return rates.filter(rate => monitoredCurrencies.includes(rate.title))
}

export const parseXml = async (xml: string) => {
  const parsedJson = await parser.toJson(xml)
  const rates = JSON.parse(parsedJson).rss.channel.item

  return rates
}

export const getRSS = async () => {
  const rates = await axios.get(nationalBankRates, {
    headers: { 'Content-Type': 'text/xml' }
  })

  return rates.data
}
