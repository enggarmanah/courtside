const http = require('http');
const https = require('https');



const originalHttpsAgent = https.Agent;
https.Agent = function(options) {
  const opt = options || {};
  opt.keepAlive = false;
  return new originalHttpsAgent(opt);
};
https.Agent.prototype = originalHttpsAgent.prototype;

const originalHttpAgent = http.Agent;
http.Agent = function(options) {
  const opt = options || {};
  opt.keepAlive = false;
  return new originalHttpAgent(opt);
};
http.Agent.prototype = originalHttpAgent.prototype;

if (https.globalAgent) {
  https.globalAgent.keepAlive = false;
  if (https.globalAgent.options) https.globalAgent.options.keepAlive = false;
}
if (http.globalAgent) {
  http.globalAgent.keepAlive = false;
  if (http.globalAgent.options) http.globalAgent.options.keepAlive = false;
}

// Locate global firebase-tools CLI relative to npm install root
const path = require('path');
const appData = process.env.APPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming') : '');
const firebasePath = path.join(appData, 'npm/node_modules/firebase-tools/lib/bin/firebase.js');

require(firebasePath);
