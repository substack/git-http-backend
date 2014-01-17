var test = require('tape');
var rimraf = require('rimraf');
var fs = require('fs');
var path = require('path');
var child = require('child_process');
var testServer = require(path.join(__dirname, 'test-server.js'));
var repoDir = path.join(__dirname, 'repos');
var npmOutput = fs.readFileSync(
    path.join(__dirname, 'npm-install-dat-stdout.txt'), 'utf8'
);

test('cleanup', cleanup);
test('setup', setup);

test('all side band messages get received', function(t) {
    var server = testServer();
    server.listen(0, push);
    
    function push() {
        var port = server.address().port;
        var cmd = 'git push http://localhost:' + port + '/test.git master';
        child.exec(cmd, function(err, stderr, stdout) {
            t.false(err);
            
            var lines = [];
            
            stdout.split('\n').map(function(l) {
                if (l.match(/^remote:/)) lines.push(l);
            });
            var actual = npmOutput.split('\n');
             
            for (var i = 0; i < lines.length; i++) {
                t.true(
                    lines[i].indexOf(actual[i]) > -1,
                    'lines match: ' + lines[i]
                );
            }
            server.close();
            t.end();
        });
    };
});

test('cleanup', cleanup);

function setup(t) {
    fs.mkdirSync(repoDir);
    var cmd = 'git init repos/test.git --bare -q';
    child.exec(cmd, {cwd: __dirname}, function(e, stdout, stderr) {
        t.false(e);
        t.end();
    });
}

function cleanup(t) {
    rimraf(repoDir, function(err) {
        t.false(err);
        t.end();
    });
};
