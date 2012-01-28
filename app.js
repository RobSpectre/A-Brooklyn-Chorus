// Dependencies

var express = require('express'), 
    app = express.createServer(), 
    io = require('socket.io').listen(app);

var twilio = require('twilio');

var redis = require('redis'),
    client = redis.createClient();

var crypto = require('crypto');

var local_settings = require('./local_settings.js');

// Web app

app.use(express.bodyParser());
app.use(express.static(__dirname + '/static'));

app.get('/', function(req, res){
    res.render('index.jade', {
        title: 'Home',
        io_url: 'http://localhost:5000',
        layout: false
    });
});


// Twilio app

function analyzeSentiment(twilio_request) {
    console.log("Analyzing sentiment: " + twilio_request.Body);
    var path = "http://access.alchemyapi.com/calls/text/TextGetTextSentiment?outputMode=json&apikey=" + ALCHEMY_API_KEY + "&text=" + encodeURIComponent(twilio_request.Body);
    var request = require('request');
    request(path , function(error, response, body){
        if (!error && response.statusCode==200) {
            var sentiment = JSON.parse(body);
            console.log("Sentiment analyzed: " + twilio_request.Body);
            console.log("Sentiment: " + sentiment.docSentiment.type);
            console.log("Score: " + sentiment.docSentiment.score);
            client.publish("chorus", JSON.stringify({sms: twilio_request, sentiment: sentiment}));
            return sentiment;
        }
    });
}

function sms(text, res) {
    console.log("Reply SMS " + text);
    var r = new twilio.Twiml.Response();
    r.append(new twilio.Twiml.Sms(text));
    res.send(r.toString());
}

function processTwilioRequest(body) {
    var from_hash = crypto.createHash('md5').update(body.From).digest("hex");
    return {
        Body: body.Body,
        From: from_hash,
        City: body.FromCity,
        State: body.FromState,
        Country: body.FromCountry,
        Zip: body.FromZip
    };
}

app.post('/sms', function(req,res){
    console.log("SMS received.");
    if (req.body.Body !== undefined) {
        var twilio_request = processTwilioRequest(req.body);
        if (twilio_request.Body.toUpperCase() === "HELP") {
            sms("Welcome to A Brooklyn Chorus: Text how you feel to interact with this piece.", res);
        } else {
            var sentiment = analyzeSentiment(twilio_request);
            if (twilio_request.Body.length < 7) {
                sms("This piece analyzes your sentiment - try replying again with more words for better effect.", res);
            } else {
                var responses = [];
                responses.push("This piece feeds off your emotion.  The more you send, the bigger your representation in the piece.");
                responses.push("Don't be afraid to get emotional - the more you text, the piece grows in complexity.");
                responses.push("A Brooklyn Chorus is an emotive installation - keep texting to see more activity.");
                responses.push("Thank you - continue texting how you feel and the piece will continue to react.");
                responses.push("Keep the words coming - A Brooklyn Chorus is completely interactive.");
                responses.push("The nodes you see in the piece are derived from the sentiment of text messages received. Keep them coming.");
                responses.push("Each node is sized by how positive and negative the texter is being.  Keep texting to see the effect.");
                responses.push("Polarizing statements make each node bigger.  Keep sending extremely positive or negative texts to see the effect.");
                sms(responses[Math.floor(Math.random()*responses.length)], res);
            }
        }
    }
});


// Pub/sub server

io.sockets.on('connection', function(socket){
    var subscribe = redis.createClient();
    
    socket.on('message', function(msg){
        console.log(msg);
        if (msg.action == "subscribe") {
            console.log("Subscribe on " + msg.channel);
            subscribe.subscribe(msg.channel);
        }
        if (msg.action == "unsubscribe") {
            console.log("Unsubscribe on " + msg.channel);
            subscribe.unsubscribe(msg.channel);
        }
    });

    socket.on('disconnect', function(){
        subscribe.quit();
    });

    subscribe.on('message', function(channel, message){
        console.log(channel +": " + message);
        socket.emit('message', {
            channel: channel,
            data: JSON.parse(message)
        });
    });
});

app.listen(5000);
