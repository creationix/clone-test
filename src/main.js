"use strict";

var request = require('./request');
// var tcp = require('./tcp-chrome');
var tcp = require('./tcp-ws-proxy')("ws://git-browser.creationix.com:8080/");

var httpTransport = require('./transport-http')(request);
var tcpTransport = require('./transport-tcp')(tcp);
var fetchPackProtocol = require('./git-fetch-pack');


// var transport = httpTransport("https://github.com/creationix/tedit-sites.git", "d8198027b52815765064e9863e7f690c5c15f8e6");
// var transport = httpTransport("https://github.com/creationix/conquest.git")
// var transport = httpTransport("https://bitbucket.org/creationix/conquest.git", "creationix");
// var transport = httpTransport("https://git.geekli.st/creationix/conquest.git");
// var transport = httpTransport("https://git.gitorious.org/creationix/conquest.git");
// var transport = httpTransport("https://gitlab.com/creationix/creationix.git");
var transport = tcpTransport("/creationix/conquest.git", "github.com");

var api = fetchPackProtocol(transport);

var refs = yield api.take();
api.put({want: refs.HEAD});
api.put(null);
api.put({done: true});
// console.log(refs);
