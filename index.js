var express = require('express')
var app = express();

var FeedParser = require('feedparser');
var request = require('request');
var Twit = require('twit');
var CronJob = require('cron').CronJob;
var tweets = require('./tweets.json');
var tweet;
var T = new Twit({
	consumer_key: 'y4Qcy1wA0IyS3rMF1vy9enJ2l',
	consumer_secret: 'pOzfY22xKlzxrWjvLo8vPe4Uj9DsP4OQWlpJZZD0g6O5C0o04D',
	access_token: '2905695612-fUM7koS3ccAAV4YBDJHzTO0sD70mR0RBGAmZuS8',
	access_token_secret: 'ogc3HfLZumYa8v5omcAM3QnWzKnc2NA1TgRCW48GzvoIa'
});
var getCourses = function() {
	var req = request('http://www.nationalbank.kz/rss/rates_all.xml');
	var feedparser = new FeedParser();
	req.on('error', function(error) {
		console.error(error);
	});
	req.on('response', function(res) {
		var stream = this;
		if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));
		stream.pipe(feedparser);
	});
	feedparser.on('error', function(error) {
		console.log(error);
	});
	feedparser.on('readable', function() {
		var stream = this;
		var meta = this.meta;
		var item;
		while (item = stream.read()) {
			if (item.title === 'USD') {
				switch (item.index) {
				case 'DOWN':
					tweet = tweet.downUSD.replace(tweets.textsUSD, item.summary).replace(tweets.textsChange, item.change);
					break;
				case 'UP':
					tweet = tweet.upUSD.replace(tweets.textsUSD, item.summary).replace(tweets.textsChange, item.change);
					break;
				default:
					tweet = tweets.stable.replace(tweets.textsUSD, item.summary);
					break;
				}
			} else if (item.title === 'EUR') {
				switch (item.index) {
				case 'DOWN':
					tweet = tweet.downEUR.replace(tweets.textsEUR, item.summary).replace(tweets.textsChange, item.change);
					break;
				case 'UP':
					tweet = tweet.upEUR.replace(tweets.textsEUR, item.summary).replace(tweets.textsChange, item.change);
					break;
				default:
					tweet = tweet.replace(tweets.textsEUR, item.summary);
					break;
				}
			}
		}
		return tweet;
	});
	return tweet;
}
var sendTweet = function() {
	T.post('statuses/update', {
		status: tweet
	}, function(err, data, response) {
		if (err) throw err;
		console.log(data.text);
	});
};
var job = new CronJob({
	cronTime: '00 10 * * *',
	onTick: function() {
		setTimeout(getCourses, 0);
		setTimeout(sendTweet, 5000);
	},
	start: true,
	timeZone: 'Asia/Almaty'
});
job.start();

// simple Index Page
app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))

app.get('/', function(request, response) {
  response.send('Hello World!')
})

app.listen(app.get('port'), function() {
  console.log('Node app is running at localhost:' + app.get('port'))
})