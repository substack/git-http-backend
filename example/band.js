var http = require('http');
var spawn = require('child_process').spawn;
var path = require('path');
var backend = require('../');

var server = http.createServer(function (req, res) {
    var repo = req.url.split('/')[1];
    var dir = path.join(__dirname, 'repos', repo);
    
    req.pipe(backend(req.url, function (err, service) {
        if (err) return res.end(err + '\n');
        
        res.setHeader('content-type', service.type);
        console.log(service.action, repo, service.fields);
        
        if (service.action === 'info') {
            var sb = service.createBand();
            sb.end('\x1b[1m\x1b[32mWHY HELLO THERE\x1b[0m');
        }
        
        var ps = spawn(service.cmd, service.args.concat(dir));
        ps.stdout.pipe(service.createStream()).pipe(ps.stdin);
        
    })).pipe(res);
});
server.listen(5000);
