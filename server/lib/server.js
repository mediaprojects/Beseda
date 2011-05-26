var fs    = require('fs'),
    path  = require('path'),
    util  = require('util'),
    http  = require('http'),
    https = require('https');


var IO                  = require('./io.js'),
    Router              = require('./router.js'),
    MessageRouter       = require('./message_router.js'),
    SubscriptionManager = require('./subscription_manager.js');

var utils = require('./utils.js');

Server = module.exports = function(options) {
    process.EventEmitter.call(this);

    var defaultOptions = {
        server  : {
		    host : '0.0.0.0',
		    port : 4000,
		    ssl  : false
		},

        pubSub : 'memory',
        debug   : false,

        transports : [ 'webSocket', 'longPolling', 'JSONPLongPolling' ]
    };

    this.options = utils.merge(defaultOptions, options);

    /**
     *  Setup HTTP server
     **/
    if (this.options.server.constructor == Object) {
        // Create own http server from options
        if (this.options.server.ssl != false) {
            // Create https server with credentials
            var credentials = {};
            if (path.existsSync(this.options.server.ssl.key)) {
                credentials.key = fs.readFileSync(this.options.server.ssl.key, 'utf8');
            } else {
                credentials.key = this.options.server.ssl.key;
            }

            if (path.existsSync(this.options.server.ssl.cert)) {
                credentials.cert = fs.readFileSync(this.options.server.ssl.cert, 'utf8');
            } else {
                credentials.cert = this.options.server.ssl.cert;
            }

            this.httpServer = https.createServer(credentials);
        } else {
            // Create basic http server
            this.httpServer = http.createServer();
        }
    } else {
        // Use server from options
        this.httpServer = this.options.server;
    }

    /**
     *  Setup Routers
     **/
    this.router = new Router();
    this.router.get('/beseda/js/:filename', function(request, response, params) {
		var file = __dirname + '/../../client/js/' + params.filename;
		Router.Utils.sendFile(request, response, file, 'text/javascript');
	});

    this.messageRouter = new MessageRouter(this);

	/**
     *  Setup IO
     **/
	this.io = new IO(this);
    this.io.on('message', this.messageRouter.dispatch.bind(this.messageRouter));
    this.io.on('disconnect', this._onDisconnect.bind(this));

    // Add request listener with static before others
    var self = this;
    var requestListeners = this.httpServer.listeners('request');
    this.httpServer.removeAllListeners('request');
    this.httpServer.addListener('request', function(request, response) {
        if (!self.router.dispatch(request, response)) {
            for (var i = 0; i < requestListeners.length; i++) {
                requestListeners[i].call(this, request, response);
            }
        }
    });

	//var upgradeListeners = this.httpServer.listeners('upgrade');
	this.httpServer.addListener('upgrade', function(request, socket, head) {
	    self.router.dispatch(request, socket, head);
	});

    /**
     *  Setup subscription manager
     **/
    this.subscriptionManager = new SubscriptionManager(this);

    /**
     *  Setup PubSub
     **/
    if (typeof this.options.pubSub == 'string') {
        var PubSub = require('./pubsub/' + this.options.pubSub);
        this.pubSub = new PubSub();
    } else if (this.options.pubSub.constructor == Object) {
        var pubSubOptions = utils.clone(this.options.pubSub);
        var type = pubSubOptions.type;
        delete pubSubOptions.type;

        var PubSub = require('./pubsub/' + type);
        this.pubSub = new PubSub(pubSubOptions);
    } else {
        // Use PubSub from options
        this.pubSub = this.options.pubSub;
    }

    if (this._isHTTPServerOpened()) {
        this._logBesedaStarted();
    }
};

util.inherits(Server, process.EventEmitter);

Server.prototype.listen = function(port, host) {
    if (this._isHTTPServerOpened()) {
        throw new Error('HTTP server already listen');
    }

    host = host || this.options.host;
    port = port || this.options.port;

    try {
        this.httpServer.listen(port, host);
    } catch (e) {
        throw new Error('Cant start beseda on ' + host + ':' + port + ': ' + e);
    }

    this._logBesedaStarted();
};

Server.prototype.log = function(message) {
    if (this.options.debug) {
        util.log(message);
    }
}

Server.prototype._onDisconnect = function(connectionId) {
    var session = Session.get(connectionId);

    if (session) {
        this.log('Session ' + session.id + ' is disconnected');
        this.emit('disconnect', session);
        session.destroy();
    } else {
        this.log('Client ' + connectionId + ' without session is disconnected');
    }
};

Server.prototype._isHTTPServerOpened = function() {
    return typeof this.httpServer.fd === 'number';
};

Server.prototype._logBesedaStarted = function() {
    var serverAddress = this.httpServer.address();

    (this.options.debug ? util : console).log('Beseda started on ' +
                                              serverAddress.address +
                                              ':' + serverAddress.port);
};
