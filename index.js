var Duplex = require('stream').Duplex;
var inherits = require('inherits');
var url = require('url');
var qs = require('querystring');

var Service = require('./lib/service.js');

var regex = {
    'git-receive-pack': RegExp('([0-9a-fA-F]+) ([0-9a-fA-F]+)'
        + ' refs\/(heads|tags)\/(.*?)( |00|\u0000)'
        + '|^(0000)$'
    ),
    'git-upload-pack': /^\S+ ([0-9a-fA-F]+)/,
    'done': /([0-9a-fA-F]+done|0000)\s+$/,
    'have': /[0-9a-fA-F]+have\s [0-9a-fA-F]/
};
var fields = {
    'git-receive-pack': [ 'last', 'head', 'ref', 'name' ],
    'git-upload-pack': [ 'head', 'have' ]
};

module.exports = Backend;
inherits(Backend, Duplex);

function Backend (uri, cb) {
    if (!(this instanceof Backend)) return new Backend(uri, cb);
    var self = this;
    Duplex.call(this);

    if (cb) {
        this.on('service', function (s) { cb(null, s) });
        this.on('error', cb);
    }

    try { uri = decodeURIComponent(uri) }
    catch (err) { return error(msg) }

    var u = url.parse(uri);
    if (/\.\/|\.\./.test(u.pathname)) return error('invalid git path');

    this.parsed = false;
    var parts = u.pathname.split('/');

    if (/\/info\/refs$/.test(u.pathname)) {
        var params = qs.parse(u.query);
        this.service = params.service;
        this.info = true;
    }
    else {
        this.service = parts[parts.length-1];
    }

    if (this.service === 'git-upload-pack') {}
    else if (this.service === 'git-receive-pack') {}
    else return error('unsupported git service');

    if (this.info) {
        var service = new Service({ cmd: this.service, info: true }, self);
        process.nextTick(function () {
            self.emit('service', service);
        });
    }

    function error (msg) {
        var err = typeof msg === 'string' ? new Error(msg) : msg;
        process.nextTick(function () { self.emit('error', err) });
    }
}

Backend.prototype._read = function (n) {
    if (this._stream && this._stream.next) {
        this._ready = false;
        this._stream.next();
    }
    else this._ready = n;
};

Backend.prototype._write = function (buf, enc, next) {
    if (this._stream) {
        this._stream.push(buf);
        this._next = next;
        return;
    }
    else if (this.info) {
        this._buffer = buf;
        this._next = next;
        return;
    }

    if (this._prev) buf = Buffer.concat([ this._prev, buf ]);

    var m, s = buf.toString('utf8');
    if (!this.serviceInfo && (m = regex[this.service].exec(s))) {
        this._prev = null;
        this._buffer = buf;
        this._next = next;

        var keys = fields[this.service];
        var row = { cmd: this.service };
        for (var i = 0; i < keys.length; i++) {
            row[keys[i]] = m[i+1];
        }
        this.serviceInfo = row;
    }
    else if (!this.serviceInfo && buf.length >= 512) {
        return this.emit('error', new Error('unrecognized input'));
    }

    if (this.serviceInfo && regex.have.test(s)) {
        this.serviceInfo.have = true;
        // emit early because request can no longer be clone
        this.emit('service', new Service(this.serviceInfo, this));
        return;
    }

    if ( this.serviceInfo && regex.done.test(s)) {
        this.emit('service', new Service(this.serviceInfo, this));
    } else {
        this._prev = (!this.serviceInfo ? buf : undefined);
        next();
    }
};
