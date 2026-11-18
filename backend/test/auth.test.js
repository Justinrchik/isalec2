'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createToken, verifyToken, safePasswordEqual } = require('../auth');

const options = {
  teamId: 'prjD6',
  signingKey: 'a-test-only-signing-key-that-is-long-enough',
  lifetimeSeconds: 60 * 60 * 2
};

test('creates and verifies a signed JWT', () => {
  const token = createToken(options);
  const claims = verifyToken(token, options);
  assert.equal(claims.sub, 'admin');
  assert.equal(claims.team, 'prjD6');
  assert.ok(claims.exp - claims.iat >= 60 * 60 * 2);
});

test('rejects a tampered JWT', () => {
  const token = createToken(options);
  const tampered = `${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`;
  assert.equal(verifyToken(tampered, options), null);
});

test('uses constant-time password comparison behavior', () => {
  assert.equal(safePasswordEqual('BCIT12', 'BCIT12'), true);
  assert.equal(safePasswordEqual('wrong', 'BCIT12'), false);
});

