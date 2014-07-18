"use strict";

var request = require('./request');
// var tcp = require('./tcp-chrome');
var tcp = require('./tcp-ws-proxy')("ws://git-browser.creationix.com:8080/");

var httpTransport = require('./transport-http')(request);
var tcpTransport = require('./transport-tcp')(tcp);
var fetchPackProtocol = require('./git-fetch-pack');

var defaultsPort = {
  git: 9418,
  http: 80,
  https: 442
};

var url = getUrl();
if (url) {
  var textarea = document.querySelector("textarea");
  textarea.value += "Connecting to " + url.url + "...\n";
  var transport;
  if (url.protocol === "git") {
    transport = tcpTransport(url.path, url.domain, url.port);
    textarea.value += "Using websocket proxy for git:// protocol...\n";
  }
  else {
    var portString = url.port === defaultsPort[url.protocol] ? "" : (":" + url.port);
    var fullUrl = url.protocol + "://" + url.domain + portString + url.path;
    transport = httpTransport(fullUrl, url.username, url.password);
    textarea.value += "Using direct XHR requests for " + url.protocol + " protocol...\n";
  }
  var api = fetchPackProtocol(transport, function (err) {
    textarea.value += "Network Error:\n" + err.toString + "\n";
    throw err;
  });

  var refs = yield api.take();

  textarea.value += "Remote server capabilities: " + JSON.stringify(refs.caps, null, 2) + "\n";

  textarea.value += "Remote refs:\n" + Object.keys(refs).map(function (name) {
    return "  " + refs[name] + " " + name + "\n";
  }).join("");
}
else {
  // // var transport = httpTransport("https://github.com/creationix/tedit-sites.git", "d8198027b52815765064e9863e7f690c5c15f8e6");
  // // var transport = httpTransport("https://github.com/creationix/conquest.git")
  // // var transport = httpTransport("https://bitbucket.org/creationix/conquest.git", "creationix");
  // // var transport = httpTransport("https://git.geekli.st/creationix/conquest.git");
  // // var transport = httpTransport("https://git.gitorious.org/creationix/conquest.git");
  // // var transport = httpTransport("https://gitlab.com/creationix/creationix.git");
  // var transport = tcpTransport("/creationix/conquest.git", "github.com");

  // // Start a fetch-pack request over the transport
  // var api = fetchPackProtocol(transport);

  // // Get the refs on the remote
  // var refs = yield api.take();
  // console.log(refs);

  // // Tell it we want whatever HEAD points to
  // api.put({want: refs.HEAD});
  // api.put(null);
  // api.put({done: true});
}

function getUrl() {
  var match = document.location.search.match(/\burl=([^=&]*)/);
  if (!match) return;
  var url = window.unescape(match[1]);
  document.querySelector("input[name=url]").value = url;
  match = url.match(/^(https?|git):\/\/(?:([^@:]+)(?:([^@]+))?@)?([^\/:]+)(:[0-9]+)?(\/[^?]*)$/);
  if (!match) return;
  return {
    url: url,
    protocol: match[1],
    username: match[2],
    password: match[3],
    domain: match[4],
    port: match[5] || defaultsPort[match[1]],
    path: match[6]
  };
}
