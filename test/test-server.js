var http = require('http');
var spawn = require('child_process').spawn;
var path = require('path');
var backend = require(path.join(__dirname, '..'));
var fs = require('fs');
var npmOutputPath = path.join(__dirname, 'npm-install-dat-stdout.txt')

module.exports = function() {
  var server = http.createServer(function (req, res) {
      var repo = req.url.split('/')[1];
      var dir = path.join(__dirname, 'repos', repo);
      
      var bs = backend(req.url, function (err, service) {
          if (err) return res.end(err + '\n');
          res.setHeader('Content-Type', service.type);
          
          if (service.action === 'info') {
              var sb = service.createBand();
              
              fs.createReadStream(npmOutputPath).pipe(sb);
          }

          var ps = spawn(service.cmd, service.args.concat(dir));
          ps.stdout.pipe(service.createStream()).pipe(ps.stdin);
      })
      
      req.pipe(bs).pipe(res);
  });
  
  return server
}