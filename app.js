var express = require('express'), 
    app = express.createServer(), 
    io = require('socket.io').listen(app);

app.use(express.bodyParser());

var twilio = require('twilio');

var redis = require("redis"),
    client = redis.createClient();

app.get('/', function(req, res){
    res.render('index.jade', {
        title: 'Home',
        io_url: 'http://localhost:5000',
        layout: false
    });
});

app.post('/sms', function(req,res){
    console.log("SMS received.");
    if (req.body.Body !== undefined) {
        console.log("Analyzing sentiment of " + req.body.Body);
        var path = "http://access.alchemyapi.com/calls/text/TextGetTextSentiment?apikey=e7bc8ff3ec4f1780eeeb64525d3d9e5a0dddd072&outputMode=json&text=" + encodeURIComponent(req.body.Body);
        var request = require('request');
        request(path , function(error, response, body){
            if (!error && response.statusCode==200) {
                body = JSON.parse(body);
                console.log("Sentiment: " + body.docSentiment.type);
                console.log("Score: " + body.docSentiment.score);
                client.publish("chorus", JSON.stringify({sms: req.body, sentiment: body}));
            }
        });
    }
    var r = new twilio.Twiml.Response();
    r.append(new twilio.Twiml.Sms('We got your message'));
    res.send(r.toString());
});

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
