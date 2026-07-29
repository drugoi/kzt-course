import dotenv from 'dotenv'

dotenv.config()

import { CronJob } from 'cron'
import { TwitterApi, TwitterApiTokens } from 'twitter-api-v2'

import { formatText } from './format'
import { RateHistory } from './history'
import { getMonitoredRates, getRSS, parseXml } from './parse'
import {
  createCurrenciesMap,
  createRateSnapshot,
  findChangeMismatches
} from './rates'
import tweetsRU from './locales/ru.json'
import tweetsKK from './locales/kk.json'
import { CurrenciesMap, LocaleText } from './types'

let twitterClient: TwitterApi | null = null

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

const generateTweet = (currenciesMap: CurrenciesMap) => {
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
    const currentSnapshot = createRateSnapshot(monitoredRates)
    const history = new RateHistory()

    try {
      const previousSnapshot = history.findPreviousSnapshot(
        currentSnapshot.rateDate
      )
      const currenciesMap = createCurrenciesMap(
        currentSnapshot,
        previousSnapshot
      )

      if (previousSnapshot) {
        for (const mismatch of findChangeMismatches(
          currentSnapshot,
          currenciesMap
        )) {
          console.warn('RSS change differs from calculated history', {
            date: currentSnapshot.rateDate,
            ...mismatch
          })
        }
      }

      history.saveSnapshot(currentSnapshot)

      const { tweetKK, tweetRU } = generateTweet(currenciesMap)

      const shouldPublish =
        process.env.FORCE_UPDATE === 'true' ||
        process.env.NODE_ENV === 'production'

      if (shouldPublish) {
        await sendTweet(tweetKK)
        await sendTweet(tweetRU)
      } else if (process.env.NODE_ENV !== 'test') {
        console.log('🚀 ~ tweetKK, tweetRU', { tweetKK, tweetRU })
      }
    } finally {
      history.close()
    }

    if (
      process.env.FORCE_UPDATE !== 'true' &&
      process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'test'
    ) {
      process.exit()
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
