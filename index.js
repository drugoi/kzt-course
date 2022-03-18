require('dotenv').config()

const axios = require('axios')
const parser = require('xml2json')

const Twit = require('twit')
const CronJob = require('cron').CronJob

const tweetsRU = require('./locales/ru.json')
const tweetsKK = require('./locales/kk.json')

const nationalBankRates = 'https://www.nationalbank.kz/rss/rates_all.xml'

const monitoredCurrencies = ['RUB', 'EUR', 'USD']

let TwitterAPI = null

if (process.env.KZT_TWITTER_CONSUMER_KEY) {
  TwitterAPI = new Twit({
    consumer_key: process.env.KZT_TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.KZT_TWITTER_CONSUMER_SECRET,
    access_token: process.env.KZT_TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.KZT_TWITTER_ACCESS_TOKEN_SECRET
  })
}

const sendTweet = tweet => {
  if (process.env.DEBUG === 'true') {
    return console.info('Composed tweet', tweet)
  }
  TwitterAPI.post(
    'statuses/update',
    {
      status: tweet
    },
    (err, { text }) => {
      if (err) throw err
      console.info('🚀 ~ text', text)
    }
  )
}

const formatText = (text, currenciesMap) => {
  return text
    .replace('{RATE_USD}', currenciesMap.USD.amount)
    .replace('{RATE_CHANGE_USD}', currenciesMap.USD.change)
    .replace('{RATE_RUB}', currenciesMap.RUB.amount)
    .replace('{RATE_CHANGE_RUB}', currenciesMap.RUB.change)
    .replace('{RATE_EUR}', currenciesMap.EUR.amount)
    .replace('{RATE_CHANGE_EUR}', currenciesMap.EUR.change)
}

const generateTweet = rates => {
  const currenciesMap = rates.reduce(
    (acc, rate) => {
      acc[rate.title].amount = rate.description
      acc[rate.title].change = rate.change
      return acc
    },
    {
      USD: {
        amount: 0,
        change: 0
      },
      RUB: {
        amount: 0,
        change: 0
      },
      EUR: {
        amount: 0,
        change: 0
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

const getMonitoredRates = rates => {
  return rates.filter(rate => monitoredCurrencies.includes(rate.title))
}

const parseXml = xml => {
  const parsedJson = parser.toJson(xml)
  const rates = JSON.parse(parsedJson).rss.channel.item

  return rates
}

const getRSS = async () => {
  const rates = await axios.get(nationalBankRates, {
    headers: { 'Content-Type': 'text/xml' }
  })

  return rates.data
}

const job = new CronJob({
  cronTime: '00 09 * * *',
  onTick: () => {
    getRSS()
      .then(parseXml)
      .then(getMonitoredRates)
      .then(generateTweet)
      .then(({ tweetKK, tweetRU }) => {
        sendTweet(tweetKK)
        sendTweet(tweetRU)
      })
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
  getRSS()
    .then(parseXml)
    .then(getMonitoredRates)
    .then(generateTweet)
    .then(({ tweetKK, tweetRU }) => {
      if (process.env.FORCE_UPDATE === 'true') {
        sendTweet(tweetKK)
        sendTweet(tweetRU)
      } else {
        console.log('🚀 ~ .then ~ tweetKK, tweetRU', { tweetKK, tweetRU })
        process.exit()
      }
    })
}
