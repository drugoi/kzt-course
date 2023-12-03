import dotenv from 'dotenv'

dotenv.config()

import { CronJob } from 'cron'
import { TwitterApi, TwitterApiTokens } from 'twitter-api-v2'

import { formatText } from './format'
import { getMonitoredRates, getRSS, parseXml } from './parse'
import tweetsRU from './locales/ru.json'
import tweetsKK from './locales/kk.json'
import { CurrenciesMap, Rates } from './types'

let TwitterClient: any = null

if (process.env.KZT_TWITTER_CONSUMER_KEY) {
  TwitterClient = new TwitterApi({
    appKey: process.env.KZT_TWITTER_CONSUMER_KEY,
    appSecret: process.env.KZT_TWITTER_CONSUMER_SECRET,
    accessToken: process.env.KZT_TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.KZT_TWITTER_ACCESS_TOKEN_SECRET
  } as TwitterApiTokens)
}

const sendTweet = async (tweet: string) => {
  if (process.env.DEBUG === 'true') {
    return console.info('Composed tweet', tweet)
  }

  try {
    await TwitterClient.v2.tweet(tweet)
  } catch (error) {
    console.error('🚀 ~ sendTweet ~ error:', error)
  }
}

const generateTweet = (rates: Rates) => {
  const currenciesMap = rates.reduce(
    (acc: CurrenciesMap, rate) => {
      acc[rate.title as keyof CurrenciesMap].amount = rate.description
      acc[rate.title as keyof CurrenciesMap].change = rate.change
      return acc
    },
    {
      USD: {
        amount: '0',
        change: '0'
      },
      RUB: {
        amount: '0',
        change: '0'
      },
      EUR: {
        amount: '0',
        change: '0'
      }
    }
  )

  const tweetRU = formatText(tweetsRU.text, currenciesMap)
  const tweetKK = formatText(tweetsKK.text, currenciesMap)

  return {
    tweetRU,
    tweetKK
  }
}

const processRates = async () => {
  const xmlRates = await getRSS()
  const parsedRates = await parseXml(xmlRates)
  const monitoredRates = getMonitoredRates(parsedRates)

  const { tweetKK, tweetRU } = generateTweet(monitoredRates)

  if (
    process.env.FORCE_UPDATE === 'true' ||
    process.env.NODE_ENV === 'production'
  ) {
    sendTweet(tweetKK)
    sendTweet(tweetRU)
  } else {
    console.log('🚀 ~ tweetKK, tweetRU', { tweetKK, tweetRU })
    process.exit()
  }
}

const job = CronJob.from({
  cronTime: '00 09 * * *',
  onTick: async () => {
    await processRates()
  },
  start: true,
  timeZone: 'Asia/Almaty'
})

if (process.env.KZT_TWITTER_CONSUMER_KEY) {
  job.start()
}

if (
  process.env.NODE_ENV !== 'production' ||
  process.env.DEBUG === 'true' ||
  process.env.FORCE_UPDATE === 'true'
) {
  processRates()
}
