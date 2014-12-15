require('newrelic');
var express = require('express');
var app = express();
var FeedParser = require('feedparser');
var request = require('request');
var events = require('events');
var _event = new events.EventEmitter();
var Twit = require('twit');
var CronJob = require('cron').CronJob;
var tweetsRUS = require('./tweets_rus.json');
var tweetsKAZ = require('./tweets_kaz.json');
var tweetRUS, tweetKAZ;
var tweet = {};
var T = new Twit({
	consumer_key: 'y4Qcy1wA0IyS3rMF1vy9enJ2l',
	consumer_secret: 'pOzfY22xKlzxrWjvLo8vPe4Uj9DsP4OQWlpJZZD0g6O5C0o04D',
	access_token: '2905695612-fUM7koS3ccAAV4YBDJHzTO0sD70mR0RBGAmZuS8',
	access_token_secret: 'ogc3HfLZumYa8v5omcAM3QnWzKnc2NA1TgRCW48GzvoIa'
});
var sendTweet = function(tweet) {
	T.post('statuses/update', {
		status: tweet
	}, function(err, data, response) {
		if (err) throw err;
		console.log(data.text);
	});
};
var getRSS = function() {
	var req = request('http://www.nationalbank.kz/rss/rates_all.xml');
	var feedparser = new FeedParser();
	var _this = this;
	req.on('error', function(error) {
		console.error(error);
	});
	req.on('response', function(res) {
		var stream = this;
		if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));
		stream.pipe(feedparser);
		_event.emit('received', feedparser);
	});
};
_event.on('received', function(feedparser) {
	feedparser.on('error', function(error) {
		console.error(error);
	});
	feedparser.on('readable', function() {
		var stream = this;
		var item;
		var summary;
		while (item = stream.read()) {
			switch (item.title) {
			case 'USD':
				summary = item.summary;
				switch (item.index) {
				case 'DOWN':
					tweetKAZ = tweetKAZ.downUSD.replace(tweetsKAZ.textsUSD, summary).replace(tweetsKAZ.textsChange, item.change);
					tweetRUS = tweetRUS.downUSD.replace(tweetsRUS.textsUSD, summary).replace(tweetsRUS.textsChange, item.change);
					break;
				case 'UP':
					tweetKAZ = tweetKAZ.upUSD.replace(tweetsKAZ.textsUSD, summary).replace(tweetsKAZ.textsChange, item.change);
					tweetRUS = tweetRUS.upUSD.replace(tweetsRUS.textsUSD, summary).replace(tweetsRUS.textsChange, item.change);
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
				tweet.kaz = tweetKAZ;
				tweet.rus = tweetRUS;
				_event.emit('tweet', tweet);
				break;
			}
			break;
		}
	});
});
_event.on('tweet', function(tweet) {
	sendTweet(tweet.kaz);
	sendTweet(tweet.rus);
});
var job = new CronJob({
	cronTime: '00 09 * * *',
	onTick: function() {
		getRSS();
	},
	start: true,
	timeZone: 'Asia/Almaty'
});
job.start();
// Simple Index Page for ping
app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))
app.get('/', function(request, response) {
	response.send('Hello World!')
});
app.listen(app.get('port'), function() {
	console.log('Node app is running at localhost:' + app.get('port'))
});