'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const config = require('./config');
const { createToken, verifyToken, safePasswordEqual, parseCookies } = require('./auth');

const COOKIE_NAME = `${config.teamId}_auth`;
const MAX_JSON_BYTES = 1024;
const loginAttempts = new Map();

function securityHeaders() {
  return {
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    Vary: 'Origin'
  };
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (origin === config.frontendOrigin) {
    return {
      'Access-Control-Allow-Origin': config.frontendOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
  }
  return {};
}

function sendJson(req, res, status, body, headers = {}) {
  const serialized = JSON.stringify(body);
  res.writeHead(status, {
    ...securityHeaders(),
    ...corsHeaders(req),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(serialized),
    ...headers
  });
  res.end(serialized);
}

function sendEmpty(req, res, status, headers = {}) {
  res.writeHead(status, { ...securityHeaders(), ...corsHeaders(req), ...headers });
  res.end();
}

function clientIp(req) {
  // Do not trust forwarded headers unless a known proxy has been configured.
  return req.socket.remoteAddress || 'unknown';
}

function canAttemptLogin(req) {
  const now = Date.now();
  const ip = clientIp(req);
  const entries = (loginAttempts.get(ip) || []).filter((time) => now - time < 60_000);
  if (entries.length >= 8) {
    loginAttempts.set(ip, entries);
    return false;
  }
  entries.push(now);
  loginAttempts.set(ip, entries);
  return true;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_JSON_BYTES) {
        reject(new Error('Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(raw));
      } catch (_) {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    req.on('error', () => reject(new Error('Could not read request body.')));
  });
}

function authClaims(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE_NAME];
  return verifyToken(token, config);
}

function authCookie(token, maxAge) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAge}`,
    `Path=${config.basePath}`,
    'HttpOnly',
    'Secure',
    'SameSite=None'
  ].join('; ');
}

function originIsAllowed(req) {
  return req.headers.origin === config.frontendOrigin;
}

async function handleLogin(req, res) {
  if (!originIsAllowed(req)) {
    sendJson(req, res, 403, { error: 'Request origin is not allowed.' });
    return;
  }
  if (!canAttemptLogin(req)) {
    sendJson(req, res, 429, { error: 'Too many login attempts. Try again in one minute.' });
    return;
  }
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    sendJson(req, res, 415, { error: 'Content-Type must be application/json.' });
    return;
  }
  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    sendJson(req, res, 400, { error: error.message });
    return;
  }
  const correctUsername = typeof body.username === 'string' && body.username === config.adminUsername;
  const correctPassword = safePasswordEqual(body.password, config.adminPassword);
  if (!correctUsername || !correctPassword) {
    sendJson(req, res, 401, { error: 'Invalid username or password.' });
    return;
  }
  const token = createToken(config);
  sendJson(req, res, 200, { authenticated: true }, {
    'Set-Cookie': authCookie(token, config.jwtLifetimeSeconds)
  });
}

function handleSession(req, res) {
  if (!authClaims(req)) {
    sendJson(req, res, 401, { error: 'Authentication required.' });
    return;
  }
  sendJson(req, res, 200, { teamId: config.teamId, secret: config.displayedSecret });
}

function handleLogout(req, res) {
  if (!originIsAllowed(req)) {
    sendJson(req, res, 403, { error: 'Request origin is not allowed.' });
    return;
  }
  // Required behavior: clear only this browser cookie; never revoke issued JWTs.
  sendEmpty(req, res, 204, { 'Set-Cookie': authCookie('', 0) });
}

function isValidConfiguration() {
  return config.teamId === 'prjD6' &&
    config.jwtLifetimeSeconds >= 60 * 60 * 2 &&
    typeof config.frontendOrigin === 'string' && /^https?:\/\/[^/]+$/.test(config.frontendOrigin) &&
    typeof config.jwtSigningKey === 'string' && config.jwtSigningKey.length >= 16;
}

const server = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  if (req.method === 'OPTIONS' && path.startsWith(`${config.basePath}/api/`)) {
    if (!originIsAllowed(req)) {
      sendEmpty(req, res, 403);
    } else {
      sendEmpty(req, res, 204);
    }
    return;
  }
  if (req.method === 'GET' && path === `${config.basePath}/health`) {
    sendJson(req, res, isValidConfiguration() ? 200 : 503, { status: isValidConfiguration() ? 'ok' : 'configuration-error' });
    return;
  }
  if (req.method === 'POST' && path === `${config.basePath}/api/login`) return void handleLogin(req, res);
  if (req.method === 'GET' && path === `${config.basePath}/api/session`) return void handleSession(req, res);
  if (req.method === 'POST' && path === `${config.basePath}/api/logout`) return void handleLogout(req, res);
  sendJson(req, res, 404, { error: 'Not found.' });
};

let listener;
if (config.httpsKeyFile && config.httpsCertFile) {
  listener = https.createServer({ key: fs.readFileSync(config.httpsKeyFile), cert: fs.readFileSync(config.httpsCertFile) }, server);
} else {
  listener = http.createServer(server);
}

listener.headersTimeout = 10_000;
listener.requestTimeout = 10_000;
listener.keepAliveTimeout = 5_000;
listener.listen(config.port, () => {
  const protocol = config.httpsKeyFile && config.httpsCertFile ? 'https' : 'http';
  if (config.jwtSigningKey === 'local-development-only-change-this-key') {
    console.warn('WARNING: using the local JWT signing-key fallback. Set JWT_SIGNING_KEY before deployment.');
  }
  console.log(`API listening at ${protocol}://localhost:${config.port}${config.basePath}`);
});

