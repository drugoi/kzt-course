import dotenv from 'dotenv'

dotenv.config()

import { CronJob } from 'cron'
import { TwitterApi, TwitterApiTokens } from 'twitter-api-v2'

import { formatText } from './format'
import { getMonitoredRates, getRSS, parseXml } from './parse'
import tweetsRU from './locales/ru.json'
import tweetsKK from './locales/kk.json'
import { CurrenciesMap, Rates, LocaleText } from './types'

let TwitterClient: any = null
const REQUIRED_CURRENCIES: Array<keyof CurrenciesMap> = ['USD', 'EUR', 'RUB']

if (process.env.KZT_TWITTER_CONSUMER_KEY) {
  TwitterClient = new TwitterApi({
    appKey: process.env.KZT_TWITTER_CONSUMER_KEY,
    appSecret: process.env.KZT_TWITTER_CONSUMER_SECRET,
    accessToken: process.env.KZT_TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.KZT_TWITTER_ACCESS_TOKEN_SECRET
  } as TwitterApiTokens)
}

const sendTweet = async (tweet: string) => {
  if (process.env.DEBUG === 'true' && process.env.NODE_ENV !== 'test') {
    return console.info('Composed tweet', tweet)
  }

  try {
    await TwitterClient.v2.tweet(tweet)
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('🚀 ~ sendTweet ~ error:', error)
    }
  }
}

const hasRequiredCurrencies = (
  currenciesMap: Partial<CurrenciesMap>
): currenciesMap is CurrenciesMap =>
  REQUIRED_CURRENCIES.every((currency) => Boolean(currenciesMap[currency]))

const generateTweet = (rates: Rates) => {
  const currenciesMap = rates.reduce<Partial<CurrenciesMap>>((acc, rate) => {
    if (
      REQUIRED_CURRENCIES.includes(rate.title as keyof CurrenciesMap) &&
      rate.description.trim()
    ) {
      acc[rate.title as keyof CurrenciesMap] = {
        amount: rate.description,
        change: rate.change
      }
    }
    return acc
  }, {})

  const missingCurrencies = REQUIRED_CURRENCIES.filter(
    (currency) => !currenciesMap[currency]
  )

  if (!hasRequiredCurrencies(currenciesMap)) {
    throw new Error(
      `Missing monitored currency rates: ${missingCurrencies.join(', ')}`
    )
  }

  const tweetRU = formatText((tweetsRU as LocaleText).text, currenciesMap)
  const tweetKK = formatText((tweetsKK as LocaleText).text, currenciesMap)

  return {
    tweetRU,
    tweetKK
  }
}

export const processRates = async () => {
  try {
    const xmlRates = await getRSS()
    const parsedRates = await parseXml(xmlRates)
    const monitoredRates = getMonitoredRates(parsedRates)

    const { tweetKK, tweetRU } = generateTweet(monitoredRates)

    if (
      process.env.FORCE_UPDATE === 'true' ||
      process.env.NODE_ENV === 'production'
    ) {
      await sendTweet(tweetKK)
      await sendTweet(tweetRU)
    } else {
      if (process.env.NODE_ENV !== 'test') {
        console.log('🚀 ~ tweetKK, tweetRU', { tweetKK, tweetRU })
      }
      if (process.env.NODE_ENV !== 'test') {
        process.exit()
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Error processing rates:', error)
    }
    if (process.env.NODE_ENV === 'production') {
      throw error
    }
  }
}

let job: CronJob | null = null

if (process.env.KZT_TWITTER_CONSUMER_KEY) {
  job = CronJob.from({
    cronTime: '00 09 * * *',
    onTick: async () => {
      await processRates()
    },
    start: true,
    timeZone: 'Asia/Almaty'
  })

  if (process.env.NODE_ENV !== 'test') {
    job.start()
  }
}

if (
  process.env.NODE_ENV !== 'production' ||
  process.env.DEBUG === 'true' ||
  process.env.FORCE_UPDATE === 'true'
) {
  processRates()
}

// Export for testing
export const stopCronJob = () => {
  if (job) {
    job.stop()
  }
}
