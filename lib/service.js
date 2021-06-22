var Duplex = require('stream').Duplex;
var Writable = require('stream').Writable;
var encode = require('git-side-band-message');

module.exports = Service;

function Service (opts, backend) {
    this.info = opts.info;
    this.cmd = opts.cmd;
    this._bands = [];
    
    this.action = this.info ? 'info' : {
        'git-receive-pack': (opts.tag ? 'tag' : 'push'),
        'git-upload-pack': 'pull'
    }[this.cmd];
    
    this.type = 'application/x-' + this.cmd + '-advertisement';
    this._backend = backend;
    
    this.fields = {};

    if (opts.head) this.fields.head = opts.head;
    if (opts.last) this.fields.last = opts.last;

    if (opts.refname) {
        this.fields.refname = opts.refname;

        var refInfo = /^refs\/(heads|tags)\/(.*)$/.exec(opts.refname);

        if (refInfo) {
            this.fields.ref = refInfo[1];
            this.fields.name = refInfo[2];

            if (this.action === 'tag') this.fields.tag = this.fields.name;
            else if (this.action === 'push') this.fields.branch = this.fields.name;
        }
    }


    this.args = [ '--stateless-rpc' ];
    if (this.info) this.args.push('--advertise-refs');
}

Service.prototype.createStream = function () {
    var self = this;
    var stream = new Duplex;
    var backend = this._backend;
    
    stream._write = function (buf, enc, next) {
        // dont send terminate signal
        if (buf.length === 4 && buf.toString() === '0000') stream.needsPktFlush = true
        else backend.push(buf)
        
        if (backend._ready) next()
        else stream._next = next;
    };
    
    stream._read = function () {
        var next = backend._next;
        var buf = backend._buffer;
        backend._next = null;
        backend._buffer = null;
        if (buf) stream.push(buf);
        if (next) next();
    };
    
    backend._stream = stream;
    if (backend._ready) stream._read();
    
    stream.on('finish', function f () {
        if (self._bands.length) {
            var s = self._bands.shift();
            s._write = function (buf, enc, next) {
                backend.push(encode(buf));
                next();
            };
            s.on('finish', f);
            
            var buf = s._buffer;
            var next = s._next;
            s._buffer = null;
            s._next = null;
            if (buf) backend.push(encode(buf));
            if (next) next();
        }
        else {
          if (stream.needsPktFlush) backend.push(new Buffer('0000'))
          backend.push(null)
        }
    });
    
    if (this.info) backend.push(infoPrelude(this.cmd));
    return stream;
};

Service.prototype.createBand = function () {
    var backend = this.backend;
    var stream = new Writable;
    stream._write = function (buf, enc, next) {
        stream._buffer = buf;
        stream._next = next;
    };
    this._bands.push(stream);
    return stream;
};

function infoPrelude (service) {
    function pack (s) {
        var n = (4 + s.length).toString(16);
        return Array(4 - n.length + 1).join('0') + n + s;
    }
    return pack('# service=' + service + '\n') + '0000';
}
