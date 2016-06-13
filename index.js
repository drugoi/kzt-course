'use strict';

require('newrelic');
const express = require('express');
const app = express();
const FeedParser = require('feedparser');
const request = require('request');
const events = require('events');
const _event = new events.EventEmitter();
const Twit = require('twit');
const CronJob = require('cron').CronJob;
const tweetsRUS = require('./tweets_rus.json');
const tweetsKAZ = require('./tweets_kaz.json');
let tweetRUS, tweetKAZ;
const tweet = {};
const T = new Twit({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET
});
const sendTweet = tweet => {
  T.post('statuses/update', {
    status: tweet
  }, (err, data) => {
    if (err) throw err;
    console.log(data.text);
  });
};
const getRSS = () => {
  const req = request('http://www.nationalbank.kz/rss/rates_all.xml');
  const feedparser = new FeedParser();
  req.on('error', error => {
    console.error(error);
  });
  req.on('response', function(res) {
    const stream = this;
    if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));
    stream.pipe(feedparser);
    _event.emit('received', feedparser);
  });
};
_event.on('received', feedparser => {
  feedparser.on('error', error => {
    console.error(error);
  });
  feedparser.on('readable', function() {
    const stream = this;
    let item;
    let summary;
    while ((item = stream.read()) !== null) {
      switch (item.title) {
        case 'USD':
          summary = item.summary;
          switch (item.index) {
            case 'DOWN':
              tweetKAZ = tweetsKAZ.downUSD.replace(tweetsKAZ.textsUSD, summary).replace(tweetsKAZ.textsChange, item.change);
              tweetRUS = tweetsRUS.downUSD.replace(tweetsRUS.textsUSD, summary).replace(tweetsRUS.textsChange, item.change);
              break;
            case 'UP':
              tweetKAZ = tweetsKAZ.upUSD.replace(tweetsKAZ.textsUSD, summary).replace(tweetsKAZ.textsChange, item.change);
              tweetRUS = tweetsRUS.upUSD.replace(tweetsRUS.textsUSD, summary).replace(tweetsRUS.textsChange, item.change);
              break;
            default:
              tweetKAZ = tweetsKAZ.stable.replace(tweetsKAZ.textsUSD, summary);
              tweetRUS = tweetsRUS.stable.replace(tweetsRUS.textsUSD, summary);
              break;
          }
          break;
        case 'EUR':
          summary = item.summary;
          switch (item.index) {
            case 'DOWN':
              tweetKAZ = tweetKAZ.downEUR.replace(tweetsKAZ.textsEUR, summary).replace(tweetsKAZ.textsChange, item.change);
              tweetRUS = tweetRUS.downEUR.replace(tweetsRUS.textsEUR, summary).replace(tweetsRUS.textsChange, item.change);
              break;
            case 'UP':
              tweetKAZ = tweetKAZ.upEUR.replace(tweetsKAZ.textsEUR, summary).replace(tweetsKAZ.textsChange, item.change);
              tweetRUS = tweetRUS.upEUR.replace(tweetsRUS.textsEUR, summary).replace(tweetsRUS.textsChange, item.change);
              break;
            default:
              tweetKAZ = tweetKAZ.replace(tweetsKAZ.textsEUR, summary);
              tweetRUS = tweetRUS.replace(tweetsRUS.textsEUR, summary);
              break;
          }
          break;
        case 'RUB':
          summary = item.summary;
          switch (item.index) {
            default: tweetKAZ = tweetKAZ.replace(tweetsKAZ.textsRUB, summary);
            tweetRUS = tweetRUS.replace(tweetsRUS.textsRUB, summary);
            break;
          }
          tweet.kaz = tweetKAZ;
          tweet.rus = tweetRUS;
          _event.emit('tweet', tweet);
          break;
      }
      break;
    }
  });
});
_event.on('tweet', tweet => {
  sendTweet(tweet.kaz);
  sendTweet(tweet.rus);
});
const job = new CronJob({
  cronTime: '00 09 * * *',
  onTick() {
    getRSS();
  },
  start: true,
  timeZone: 'Asia/Almaty'
});
job.start();
// Simple Index Page for ping
app.set('port', (process.env.PORT || 5000))
app.use(express.static(`${__dirname}/public`))
app.get('/', (request, response) => {
  response.send('This is node.js app for KZT Course twitter account.')
});
app.listen(app.get('port'), () => {
  console.log(`Node app is running at localhost:${app.get('port')}`)
});
