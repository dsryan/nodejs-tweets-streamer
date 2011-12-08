var http = require('http');
var events = require('events');
var url = require('url');
var sys = require("sys");
var path = require("path");
var fs = require("fs");

function load_static_file(uri, response) {
	var filename = path.join(process.cwd(), uri);
	path.exists(filename, function(exists) {
		if(!exists) {
			response.writeHeader(404, {"Content-Type": "text/plain"});
			response.end("404 Not Found\n");
			return;
		}

		fs.readFile(filename, "binary", function(err, file) {
			if(err) {
				response.writeHeader(500, {"Content-Type": "text/plain"});
				response.end(err + "\n");
				return;
			}

			response.writeHeader(200);
			response.end(file, "binary");
		});
	});
}

var options = {
  host: 'api.twitter.com',
  port: 80,
  path: '/1/statuses/public_timeline.json',
  method: 'GET'
};

var tweet_emitter = new events.EventEmitter();

function get_tweets() {
  var req = http.request(options, function(res){
    var body = '';
    res.on('data', function(data) {
      body += data;
    });
  
    res.on('end', function(){
      var tweets = JSON.parse(body);
      if (tweets.length > 0 || tweets['error'] !== undefined) {
        tweet_emitter.emit('tweets', tweets);
      }
    });
  });
  
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  req.end();
}

setInterval(get_tweets, 5000);

http.createServer(function(req, res) {
  var uri = url.parse(req.url).pathname;
  
  var tweet_listener = function(tweets) {
    res.writeHeader(200, {'content-type':'text/plain'});
    if (tweets['error'] !== undefined) {
      res.end([tweets['error']]);
    } else
      res.end(JSON.stringify(tweets));

    clearTimeout(timeout);
  };
  
  var tweet_timeout = function(){
    console.log('timeout!');
    res.writeHeader(200, {'content-type':'text/plain'});
    res.end(JSON.stringify([]));
    
    tweet_emitter.removeListener('tweets', tweet_listener);
  };

  if (uri === '/stream') {
    //The listener is invoked only the first time the event is fired, after which it is removed. Each request will add a listener.
    tweet_emitter.once('tweets', tweet_listener);
    
    var timeout = setTimeout(tweet_timeout, 10000);
  } else {
    load_static_file(uri, res);
  }
}).listen(8080);

console.log('Server running at http://localhost:8080');