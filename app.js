var app = require('express').createServer(), 
    io = require('socket.io').listen(app);

app.get('/', function(req, res){
    res.send('A Brooklyn Chorus.');
});

io.sockets.on('connection', function(socket){
    socket.emit('notice', { hello: 'world'});
});

app.configure('development', function(){
    app.use(express.static(__dirname + '/static'));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
    var oneYear = 31557600000;
    app.use(express.static(__dirname + '/static', { maxAge: oneYear }));
    app.use(express.errorHandler());
});

app.listen(5000);
