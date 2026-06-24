import dotenv from 'dotenv'

dotenv.config()

import { CronJob } from 'cron'
import { TwitterApi, TwitterApiTokens } from 'twitter-api-v2'

import { formatText } from './format'
import { getMonitoredRates, getRSS, parseXml } from './parse'
import tweetsRU from './locales/ru.json'
import tweetsKK from './locales/kk.json'
import { CurrenciesMap, Rates, LocaleText } from './types'

let twitterClient: TwitterApi | null = null
const REQUIRED_CURRENCIES: Array<keyof CurrenciesMap> = ['USD', 'EUR', 'RUB']

const getRequiredTwitterCredential = (
  name: string,
  missingCredentials: string[]
) => {
  const value = process.env[name]

  if (typeof value === 'string' && value.trim()) {
    return value
  }

  missingCredentials.push(name)
  return ''
}

const getTwitterCredentials = (): TwitterApiTokens => {
  const missingCredentials: string[] = []
  const appKey = getRequiredTwitterCredential(
    'KZT_TWITTER_CONSUMER_KEY',
    missingCredentials
  )
  const appSecret = getRequiredTwitterCredential(
    'KZT_TWITTER_CONSUMER_SECRET',
    missingCredentials
  )
  const accessToken = getRequiredTwitterCredential(
    'KZT_TWITTER_ACCESS_TOKEN',
    missingCredentials
  )
  const accessSecret = getRequiredTwitterCredential(
    'KZT_TWITTER_ACCESS_TOKEN_SECRET',
    missingCredentials
  )

  if (missingCredentials.length) {
    throw new Error(
      `Missing Twitter credentials: ${missingCredentials.join(', ')}`
    )
  }

  return {
    appKey,
    appSecret,
    accessToken,
    accessSecret
  }
}

const getTwitterClient = () => {
  if (!twitterClient) {
    twitterClient = new TwitterApi(getTwitterCredentials())
  }

  return twitterClient
}

const sendTweet = async (tweet: string) => {
  if (process.env.DEBUG === 'true' && process.env.NODE_ENV !== 'test') {
    return console.info('Composed tweet', tweet)
  }

  await getTwitterClient().v2.tweet(tweet)
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

export interface BotRuntime {
  job: CronJob | null
  initialRun: Promise<void> | null
  stop: () => void
}

export const stopCronJob = () => {
  if (job) {
    job.stop()
    job = null
  }
}

export const startBot = (): BotRuntime => {
  if (process.env.KZT_TWITTER_CONSUMER_KEY) {
    job = CronJob.from({
      cronTime: '00 09 * * *',
      onTick: async () => {
        await processRates()
      },
      start: false,
      timeZone: 'Asia/Almaty'
    })

    job.start()
  }

  const initialRun =
    process.env.NODE_ENV !== 'production' ||
    process.env.DEBUG === 'true' ||
    process.env.FORCE_UPDATE === 'true'
      ? processRates()
      : null

  return {
    job,
    initialRun,
    stop: stopCronJob
  }
}

if (require.main === module) {
  const runtime = startBot()
  runtime.initialRun?.catch((error) => {
    throw error
  })
}
