var FeedParser = require('feedparser');
var request = require('request');
var Twit = require('twit');
var CronJob = require('cron').CronJob;

var tweets = require('./tweets.json');
var twiKeys = require('./keys.json');


var T = new Twit({
	consumer_key: 'H6rctdC38OjloGgVhuF19VeNC',
	consumer_secret: 'EfbJLuDBFVFGJifZrX0s1EphriWheIsWuv8FnumtuG6wzi096F',
	access_token: '2905695612-mWGkwNWk65i9ywtbARH6Gx8SokdDS0xqYIdTBlK',
	access_token_secret: 'F8JtEK8rEvCou7AEf1j3fW91uRqb9YnFpL6SO4wBVIF9q'
});


var req = request('http://www.nationalbank.kz/rss/rates_all.xml');
var feedparser = new FeedParser();
var tweet = tweets.text1;
// var textsUSD = '{summary_usd}';
// var textsEUR = '{summary_eur}';

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
	var article;
	while (item = stream.read()) {
		if (item.title === 'USD') {
			tweet = tweet.replace('{summary_usd}', item.summary);
		} else if (item.title === 'EUR') {
			tweet = tweet.replace('{summary_eur}', item.summary);
		}
	}
	return tweet;
});
T.post('statuses/update', { status: tweet }, function(err, data, response) {
  console.log(data);
})

/*
var job = new CronJob({
  cronTime: '00 30 11 * * 1-5',
  onTick: function() {
    // Runs every weekday (Monday through Friday)
    // at 11:30:00 AM. It does not run on Saturday
    // or Sunday.
  },
  start: false,
  timeZone: 'America/Los_Angeles'
});
job.start();
*/