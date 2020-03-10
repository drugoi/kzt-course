require('dotenv').config()

const FeedParser = require('feedparser')
const request = require('request')
const events = require('events')
const Twit = require('twit')
const CronJob = require('cron').CronJob

const _event = new events.EventEmitter()

const tweetsRUS = require('./locales/ru.json')
const tweetsKAZ = require('./locales/kk.json')

const nationalBankRates = 'http://www.nationalbank.kz/rss/rates_all.xml'

let tweetRUS
let tweetKAZ

const tweet = {}

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
      console.info(text)
    }
  )
}

const getRSS = () => {
  const req = request(nationalBankRates)
  const feedparser = new FeedParser()
  req.on('error', error => {
    console.error(error)
  })
  req.on('response', function ({ statusCode }) {
    const stream = this
    if (statusCode !== 200) {
      return this.emit('error', new Error('Bad status code'))
    }
    stream.pipe(feedparser)
    _event.emit('received', feedparser)
  })
}

_event.on('received', feedparser => {
  feedparser.on('error', error => {
    console.error(error)
  })
  feedparser.on('readable', function () {
    const stream = this
    let item
    let summary

    while ((item = stream.read()) !== null) {
      switch (item.title) {
        case 'USD':
          summary = item.summary
          console.info(summary)
          switch (item.index) {
            case 'DOWN':
              tweetKAZ = tweetsKAZ.downUSD
                .replace(tweetsKAZ.textsUSD, summary)
                .replace(tweetsKAZ.textsChange, item.change)
              tweetRUS = tweetsRUS.downUSD
                .replace(tweetsRUS.textsUSD, summary)
                .replace(tweetsRUS.textsChange, item.change)
              break
            case 'UP':
              tweetKAZ = tweetsKAZ.upUSD
                .replace(tweetsKAZ.textsUSD, summary)
                .replace(tweetsKAZ.textsChange, item.change)
              tweetRUS = tweetsRUS.upUSD
                .replace(tweetsRUS.textsUSD, summary)
                .replace(tweetsRUS.textsChange, item.change)
              break
            default:
              tweetKAZ = tweetsKAZ.stable.replace(tweetsKAZ.textsUSD, summary)
              tweetRUS = tweetsRUS.stable.replace(tweetsRUS.textsUSD, summary)
              break
          }
          break
        case 'EUR':
          summary = item.summary
          switch (item.index) {
            case 'DOWN':
              tweetKAZ = tweetKAZ.downEUR
                .replace(tweetsKAZ.textsEUR, summary)
                .replace(tweetsKAZ.textsChange, item.change)
              tweetRUS = tweetRUS.downEUR
                .replace(tweetsRUS.textsEUR, summary)
                .replace(tweetsRUS.textsChange, item.change)
              break
            case 'UP':
              tweetKAZ = tweetKAZ.upEUR
                .replace(tweetsKAZ.textsEUR, summary)
                .replace(tweetsKAZ.textsChange, item.change)
              tweetRUS = tweetRUS.upEUR
                .replace(tweetsRUS.textsEUR, summary)
                .replace(tweetsRUS.textsChange, item.change)
              break
            default:
              tweetKAZ = tweetKAZ.replace(tweetsKAZ.textsEUR, summary)
              tweetRUS = tweetRUS.replace(tweetsRUS.textsEUR, summary)
              break
          }
          break
        case 'RUB':
          summary = item.summary
          switch (item.index) {
            default:
              tweetKAZ = tweetKAZ.replace(tweetsKAZ.textsRUB, summary)
              tweetRUS = tweetRUS.replace(tweetsRUS.textsRUB, summary)
              break
          }
          tweet.kaz = `${tweetKAZ} ${tweetsKAZ.hashtag}`
          tweet.rus = `${tweetRUS} ${tweetsRUS.hashtag}`
          _event.emit('tweet', tweet)
          break
      }
      break
    }
  })
})

_event.on('tweet', ({ kaz, rus }) => {
  sendTweet(kaz)
  sendTweet(rus)
})

const job = new CronJob({
  cronTime: '00 09 * * *',
  onTick () {
    getRSS()
  },
  start: true,
  timeZone: 'Asia/Almaty'
})

if (process.env.KZT_TWITTER_CONSUMER_KEY) {
  job.start()
}

if (process.env.DEBUG === 'true' || process.env.FORCE_UPDATE === 'true') {
  getRSS()
}
