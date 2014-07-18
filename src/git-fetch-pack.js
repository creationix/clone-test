"use strict";

var makeChannel = require('./channel');
var wrapHandler = require('./wrap-handler');

module.exports = fetchPack;

function fetchPack(transport, onError) {

  if (!onError) onError = throwIt;

  // Wrap our handler functions to route errors properly.
  onRef = wrapHandler(onRef, onError);
  onWant = wrapHandler(onWant, onError);
  onMore = wrapHandler(onMore, onError);

  var caps = null;
  var capsSent = false;
  var refs = {};

  // Create a duplex channel for talking with the agent.
  var libraryChannel = makeChannel();
  var agentChannel = makeChannel();
  var api = {
    put: libraryChannel.put,
    drain: libraryChannel.drain,
    take: agentChannel.take
  };

  // Start the connection and listen for the response.
  var socket = transport("git-upload-pack", onError);
  socket.take(onRef);

  // Return the other half of the duplex API channel.
  return {
    put: agentChannel.put,
    drain: agentChannel.drain,
    take: libraryChannel.take
  };

  function onRef(line) {
    if (line === undefined) {
      throw new Error("Socket disconnected");
    }
    if (line === null) {
      api.put(refs);
      api.take(onWant);
      return;
    }
    else if (!caps) {
      caps = {};
      Object.defineProperty(refs, "caps", {value: caps});
      var index = line.indexOf("\0");
      line.substring(index + 1).split(" ").forEach(function (cap) {
        var i = cap.indexOf("=");
        if (i >= 0) {
          caps[cap.substring(0, i)] = cap.substring(i + 1);
        }
        else {
          caps[cap] = true;
        }
      });
      line = line.substring(0, index);
    }
    var match = line.match(/(^[0-9a-f]{40}) (.*)$/);
    if (!match) {
      throw new Error("Invalid line: " + line);
    }
    refs[match[2]] = match[1];
    socket.take(onRef);
  }

  function onWant(line) {
    if (line === null) {
      socket.put(null);
      return api.take(onWant);
    }
    if (line.deepen) {
      socket.put("deepen " + line.deepen + "\n");
      return api.take(onWant);
    }
    if (line.want) {
      var extra = "";
      if (!capsSent) {
        capsSent = true;
        if (caps["ofs-delta"]) extra += " ofs-delta";
        if (caps["thin-pack"]) extra += " thin-pack";
        // if (caps["multi_ack_detailed"]) extra += " multi_ack_detailed";
        // else if (caps["multi_ack"]) extra +=" multi_ack";
        if (caps["side-band-64k"]) extra += " side-band-64k";
        else if (caps["side-band"]) extra += " side-band";
        // if (caps["agent"]) extra += " agent=" + agent;
        if (caps.agent) extra += " agent=" + caps.agent;
      }
      extra += "\n";
      socket.put("want " + line.want + extra);
      return api.take(onWant);
    }
    if (line.done) {
      socket.put("done\n");
      return socket.take(onMore);
    }
    throw new Error("Invalid have/want command");
  }

  function onMore(line) {
    throw new Error("TODO: implement more");
  }

}

var defer = require('js-git/lib/defer');
function throwIt(err) {
  defer(function () {
    throw err;
  });
  // throw err;
}
