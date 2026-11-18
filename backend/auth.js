'use strict';

const crypto = require('crypto');

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function jsonBase64url(value) {
  return base64url(JSON.stringify(value));
}

function sign(unsignedToken, signingKey) {
  return crypto.createHmac('sha256', signingKey).update(unsignedToken).digest('base64url');
}

function getSigningKey(options) {
  // `signingKey` is used by the small unit tests; the server config calls it
  // `jwtSigningKey` to make its purpose unambiguous.
  return options.signingKey || options.jwtSigningKey;
}

function createToken({ teamId, lifetimeSeconds, jwtLifetimeSeconds, ...keyOptions }) {
  const signingKey = getSigningKey(keyOptions);
  const tokenLifetimeSeconds = lifetimeSeconds || jwtLifetimeSeconds;
  const now = Math.floor(Date.now() / 1000);
  const header = jsonBase64url({ alg: 'HS256', typ: 'JWT' });
  const payload = jsonBase64url({
    sub: 'admin',
    team: teamId,
    iat: now,
    exp: now + tokenLifetimeSeconds,
    jti: crypto.randomBytes(16).toString('base64url')
  });
  const unsignedToken = `${header}.${payload}`;
  return `${unsignedToken}.${sign(unsignedToken, signingKey)}`;
}

function parseJsonBase64url(part) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function verifyToken(token, { teamId, ...keyOptions }) {
  const signingKey = getSigningKey(keyOptions);
  if (typeof token !== 'string' || token.length > 4096) return null;
  const pieces = token.split('.');
  if (pieces.length !== 3 || pieces.some((piece) => !piece)) return null;
  const [encodedHeader, encodedPayload, providedSignature] = pieces;
  const header = parseJsonBase64url(encodedHeader);
  const claims = parseJsonBase64url(encodedPayload);
  if (!header || header.alg !== 'HS256' || header.typ !== 'JWT' || !claims) return null;

  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, signingKey);
  const expectedBuffer = Buffer.from(expectedSignature);
  const suppliedBuffer = Buffer.from(providedSignature);
  if (expectedBuffer.length !== suppliedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (claims.sub !== 'admin' || claims.team !== teamId || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)) return null;
  if (claims.exp <= now || claims.iat > now + 60 || claims.exp <= claims.iat) return null;
  return claims;
}

function safePasswordEqual(received, configured) {
  if (typeof received !== 'string' || typeof configured !== 'string') return false;
  const receivedHash = crypto.createHash('sha256').update(received).digest();
  const configuredHash = crypto.createHash('sha256').update(configured).digest();
  return crypto.timingSafeEqual(receivedHash, configuredHash);
}

function parseCookies(header = '') {
  const cookies = Object.create(null);
  for (const pair of header.split(';')) {
    const divider = pair.indexOf('=');
    if (divider < 1) continue;
    const name = pair.slice(0, divider).trim();
    const value = pair.slice(divider + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch (_) {
      // Ignore malformed cookie values.
    }
  }
  return cookies;
}

module.exports = { createToken, verifyToken, safePasswordEqual, parseCookies };

