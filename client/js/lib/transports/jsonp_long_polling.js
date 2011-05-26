
Beseda.Transport.JSONPLongPolling = function() {
    Beseda.Transport.JSONPLongPolling._super.constructor.call(this);

    this._typeSuffix = 'JSONPLongPolling';
};

Beseda.Utils.inherits(Beseda.Transport.JSONPLongPolling, Beseda.Transport.LongPolling);

Beseda.Transport.JSONPLongPolling.isAvailable = function(options) {
    return true;
};

Beseda.Transport.JSONPLongPolling.prototype._initRequests = function() {
    this._openRequest  = new Beseda.Transport.JSONPLongPolling.JSONPRequest();
    this._dataRequest  = new Beseda.Transport.JSONPLongPolling.JSONPRequest();
    
    this._sendRequest  = new Beseda.Transport.JSONPLongPolling.JSONPRequest();
    this._closeRequest = new Beseda.Transport.JSONPLongPolling.JSONPRequest();
};

Beseda.Transport.JSONPLongPolling.prototype._initURLs = function(id) {
	Beseda.Transport.JSONPLongPolling._super._initURLs.call(this, id);

	this._sendRequest.url  += '/send';
    this._closeRequest.url += '/destroy';
};


Beseda.Transport.JSONPLongPolling.prototype._decodeData = function(data) {
    return data;
};

///////////////////////////////////////////////////////////////////////////////

Beseda.Transport.JSONPLongPolling.JSONPRequest = function() {
    Beseda.Transport.JSONPLongPolling.JSONPRequest._super.constructor.call(this);
    
    this.url = null;
    this.data = '';

    this.__id = ++Beseda.Transport.JSONPLongPolling.JSONPRequest.__lastID;
    this.__requestIndex = 0;
    this.__scripts = {};
    
    Beseda.Transport.JSONPLongPolling.JSONPRequest.__callbacks[this.__id] = {};
};

Beseda.Utils.inherits(Beseda.Transport.JSONPLongPolling.JSONPRequest, EventEmitter);

Beseda.Transport.JSONPLongPolling.JSONPRequest.__callbacks = [];
Beseda.Transport.JSONPLongPolling.JSONPRequest.__lastID = 0;

Beseda.Transport.JSONPLongPolling.JSONPRequest.prototype.send = function(url) {
    if (url) {
        this.url = url;
    }

    var timeout = (function(index, self){
        return setTimeout(function() {
            document.body.removeChild(document.getElementById('request_' + self.__id + '_' + index));
            delete self.__scripts[index];

            self.emit('error');
        }, 15000);
    })(this.__requestIndex, this);
    
    (function(index, self, timeout){
        Beseda.Transport.JSONPLongPolling.JSONPRequest.__callbacks[self.__id][index] = function(data) {
            clearTimeout(timeout);

            document.body.removeChild(document.getElementById('request_' + self.__id + '_' + index));
            delete self.__scripts[index];

            self.emit('ready', data);
        };
    })(this.__requestIndex, this, timeout);

    var requestURL = this.url + '/' + (new Date().getTime());

    requestURL += (requestURL.indexOf('?') === -1 ? '?' : '&') + 
        'callback=Beseda.Transport.JSONPLongPolling.JSONPRequest.__callbacks[' + 
            this.__id + '][' + this.__requestIndex + 
        ']&' + new Date().getTime() + '&messages=' + this.data;

    this.__scripts[this.__requestIndex] = document.createElement('script');
    this.__scripts[this.__requestIndex].src = requestURL;
    this.__scripts[this.__requestIndex].id = 'request_' + this.__id + '_' + this.__requestIndex;
    
    document.body.appendChild(this.__scripts[this.__requestIndex]);

    this.data = null;
    this.__requestIndex++;
};

Beseda.Transport.JSONPLongPolling.FormRequest = function() {
    Beseda.Transport.JSONPLongPolling.JSONPRequest._super.constructor.call(this);
    
    this.url = null;
};

