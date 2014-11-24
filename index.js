require('newrelic');

var express = require('express')
var app = express();

var FeedParser = require('feedparser');
var request = require('request');
var Twit = require('twit');
var CronJob = require('cron').CronJob;
var tweetsRUS = require('./tweets_rus.json');
var tweetsKAZ = require('./tweets_kaz.json');
var tweetRUS;
var tweetKAZ;
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
				var summary = item.summary;
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
			} else if (item.title === 'EUR') {
				var summary = item.summary;
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
			}
		}
		
		tweet = {
			kaz: tweetKAZ,
			rus: tweetRUS
		}
		return tweet;
	});
	return tweet;
}
var sendTweet = {
	kaz: function() {
		T.post('statuses/update', {
			status: tweet.kaz
		}, function(err, data, response) {
			if (err) throw err;
			console.log(data.text);
		});
	},
	rus: function() {
		T.post('statuses/update', {
			status: tweet.rus
		}, function(err, data, response) {
			if (err) throw err;
			console.log(data.text);
		});
	},
	all: function() {
		sendTweet.kaz();
		sendTweet.rus();
	}
};
var job = new CronJob({
	cronTime: '00 09 * * *',
	onTick: function() {
		setTimeout(getCourses, 0);
		setTimeout(sendTweet.all, 5000);
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