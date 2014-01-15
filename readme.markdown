# git-http-backend

serve a git repository over http

Bring your own `git-{receive,upload}-pack` implementations or shell out to the
system versions.

# example

``` js
var http = require('http');
var spawn = require('child_process').spawn;
var path = require('path');
var backend = require('git-http-backend');

var server = http.createServer(function (req, res) {
    var repo = req.url.split('/')[1];
    var dir = path.join(__dirname, 'repos', repo);
    
    req.pipe(backend(req.url, function (err, service) {
        if (err) return res.end(err + '\n');
        
        res.setHeader('content-type', service.type);
        console.log(service.action, repo, service.fields);
        
        var ps = spawn(service.cmd, service.args.concat(dir));
        ps.stdout.pipe(service.createStream()).pipe(ps.stdin);
        
    })).pipe(res);
});
server.listen(5000);
```

first create a repo with `git init` and run the server:

```
$ mkdir repos
$ git init repos/falafel.git --bare -q
$ node server.js &
[1] 10685
```

now you can push at `http://localhost:5000/falafel.git`:

```
$ cd ~/projects/node-falafel
$ git push http://localhost:5000/falafel.git master
info falafel.git {}
push falafel.git { name: 'master',
  head: 'c1cb53f6dd18cc814f42c4205e8c7efef007c171',
  last: '008a0000000000000000000000000000000000000000',
  ref: 'heads',
  branch: 'master' }
To http://localhost:5000/falafel.git
 * [new branch]      master -> master
```

and you can clone from `http://localhost:5000/falafel.git` too:

```
$ cd /tmp
$ git clone http://localhost:5000/falafel.git
Cloning into 'falafel'...
info falafel.git {}
pull falafel.git { head: 'c1cb53f6dd18cc814f42c4205e8c7efef007c171' }
remote: Counting objects: 247, done.
remote: Compressing objects: 100% (101/101), done.
remote: Total 247 (delta 139), reused 247 (delta 139)
Receiving objects: 100% (247/247), 55.40 KiB, done.
Resolving deltas: 100% (139/139), done.
```

# methods

``` js
var backend = require('git-http-backend')
```

## var b = backend(req.url, cb)

Return a duplex stream `b` from a request url `req.url`.

You should pipe an http request into `b` and pipe `b` into an http response,
like this:

```
http.createServer(function (req, res) {
    var b = backend(req.url);
    req.pipe(b).pipe(res);
})
```

If you pass in a `cb`, it will register an errback for the `'service'` and
`'error'` events.

## var sb = b.createBand()

Return a writable side-band stream `sb`.

For `info` actions, you can write a response back to the user with this stream.

# events

## b.on('service', function (service) {})

When the service header metadata has been parsed, this event fires. `service` is
a stream that outputs the request stream data from the remote git endpoint and
expects the `git-{receive,upload}-pack` data as input. You should wire up the 

`service` has these handy properties:

* `service.cmd` - the git command name string
* `service.args` - the arguments array that the git command expects
* `service.action` - the type of request: `'info'`, `'tag'`, `'push'`, or
`'pull'`
* `service.fields` - the field data associated with the request action type
* `service.type` - the `content-type` you should send for the response. Some git
clients will not work if the proper `content-type` header hasn't been sent.

For `'info`' actions, the `service.fields` is an empty object `{}`.

For `'pull'` actions, the `service.fields` are:

* `service.fields.head` - the commit hash of the requested HEAD

For `'push'` actions, the `service.fields` are:

* `service.fields.last` - the last commit in the commit payload range
* `service.fields.head` - the first commit in the commit payload range
* `service.fields.branch` - the branch name

For `'tag'` actions, the `service.fields` are:

* `service.fields.last` - the last commit in the commit payload range
* `service.fields.head` - the first commit in the commit payload range
* `service.fields.tag` - the tag text

## b.on('error', function (err) {})

Handle errors here.

# install

With [npm](https://npmjs.org) do:

```
npm install git-http-backend
```

# license

MIT
