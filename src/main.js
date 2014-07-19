"use strict";

var request = require('js-git/net/request-xhr');
var consume = require('culvert./consume');

var isApp = window.chrome && window.chrome.sockets;

var tcp = isApp ?
  require('js-git/net/tcp-chrome-sockets') :
  require('js-git/net/tcp-ws-proxy')("ws://git-browser.creationix.com:8080/");

var httpTransport = require('js-git/net/transport-http')(request);
var tcpTransport = require('js-git/net/transport-tcp')(tcp);
var fetchPackProtocol = require('js-git/net/git-fetch-pack');

var defaultPorts = {
  git: 9418,
  http: 80,
  https: 442
};

var repo = {};
require('js-git/mixins/mem-db')(repo);
require('js-git/mixins/read-combiner')(repo);
require('js-git/mixins/pack-ops')(repo);
require('js-git/mixins/walkers')(repo);
require('js-git/mixins/formats')(repo);

var progress = rewriter();

function write(part) {
  textarea.value = progress(part);
}

if (!isApp) {
  var url = getUrl();
  if (url) {

    var textarea = document.querySelector("textarea");
    write("Connecting to " + url.url + "...\n");
    var transport;
    if (url.protocol === "git") {
      transport = tcpTransport(url.path, url.domain, url.port);
      write("Using websocket proxy for git:// protocol...\n");
    }
    else {
      var portString = url.port === defaultPorts[url.protocol] ? "" : (":" + url.port);
      var fullUrl = url.protocol + "://" + url.domain + portString + url.path;
      transport = httpTransport(fullUrl, url.username, url.password);
      write("Using direct XHR requests for " + url.protocol + " protocol...\n");
    }

    var api = fetchPackProtocol(transport, function (err) {
      write("Network Error:\n" + err.toString() + "\n");
      throw err;
    });

    window.repo = repo;

    window.refs = yield* clone(repo, transport, {
      depth: 10,
      wants: ["refs/heads/master"],
      onProgress: write
    });

    write("Done!\nOpen your terminal and play with window.repo");

    // textarea.value += "Remote server capabilities: " + JSON.stringify(refs.caps, null, 2) + "\n";

    // textarea.value += "Remote refs:\n" + Object.keys(refs).map(function (name) {
    //   return "  " + refs[name] + " " + name + "\n";
    // }).join("");
  }
}
else {
  // var transport = httpTransport("https://github.com/creationix/tedit-sites.git", "d8198027b52815765064e9863e7f690c5c15f8e6");
  var transport = httpTransport("https://github.com/creationix/conquest.git");
  // var transport = httpTransport("https://bitbucket.org/creationix/conquest.git", "creationix");
  // var transport = httpTransport("https://git.geekli.st/creationix/conquest.git");
  // var transport = httpTransport("https://git.gitorious.org/creationix/conquest.git");
  // var transport = httpTransport("https://gitlab.com/creationix/creationix.git");
  var transport = tcpTransport("/creationix/conquest.git", "github.com");


  var refs = yield* clone(repo, transport, {onProgress: function (part) {
    console.log(progress(part));
  }});

  var log = yield repo.logWalk(refs.HEAD);
  var item;
  while (item = yield log.read, item !== undefined) {
    console.log(item.message);
  }
}

function rewriter() {
  var data = [];
  var offset = 0;
  var start = 0;
  return function (command) {
    for (var i = 0; i < command.length; i++) {
      var c = command[i];
      if (c === "\r") {
        offset = start;
        continue;
      }
      data[offset++] = c;
      if (c === "\n") {
        start = offset;
      }
    }
    return data.join("");
  };
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
    port: match[5] || defaultPorts[match[1]],
    path: match[6]
  };
}

function* clone(repo, transport, options) {
  // Start a fetch-pack request over the transport
  var api = fetchPackProtocol(transport);

  // Get the refs on the remote
  var refs = yield api.take;
  if (options.onRefs) {
    options.onRefs(refs);
  }

  var wants;
  if (options.wants) {
    if (typeof options.wants === "function") {
      wants = options.wants(refs);
    }
    else if (Array.isArray(options.wants)) {
      wants = options.wants;
    }
    else {
      throw new TypeError("Invalid options.wants type");
    }
  }
  else wants = Object.keys(refs);

  wants.forEach(function (want) {
    // Skip peeled refs
    if (/\^\{\}$/.test(want)) return;
    // Ask for the others
    api.put({want: refs[want]});
  });
  if (options.depth) {
    api.put({deepen: options.depth});
  }
  api.put(null);
  api.put({done: true});
  api.put();

  var channels = yield api.take;

  if (options.onProgress) {
    if (typeof options.onProgress !== "function") {
      throw new TypeError("options.onProgress must be function");
    }
    yield [
      repo.unpack(channels.pack, options),
      consume(channels.progress, options.onProgress),
    ];
  }
  else {
    yield repo.unpack(channels.pack, options);
  }
  for (var i = 0; i < wants.length; i++) {
    var name = wants[i];
    if (name === "HEAD" || !refs[name]) continue;
    yield repo.updateRef(name, refs[name]);
  }
  return refs;
}