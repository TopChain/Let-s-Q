import test from 'node:test';
import assert from 'node:assert/strict';
import { __test } from '../netlify/functions/letsq-api.mjs';

test('parses a valid action request', () => {
  assert.deepEqual(__test.parseBody({ body: '{"action":"health","payload":{}}' }), { action: 'health', payload: {} });
});

test('rejects invalid JSON without exposing internals', () => {
  assert.throws(() => __test.parseBody({ body: '{' }), /not valid JSON/);
});

test('accepts only strong bearer tokens', () => {
  const token = 'a'.repeat(43);
  assert.equal(__test.bearerToken({ authorization: `Bearer ${token}` }), token);
  assert.equal(__test.bearerToken({ authorization: 'Bearer short' }), null);
});

test('hashes host tokens and rate-limit fingerprints', () => {
  process.env.RATE_LIMIT_SECRET = 'test-secret';
  const tokenDigest = __test.tokenHash('host-token');
  const fingerprint = __test.requestFingerprint({ headers: { 'x-nf-client-connection-ip': '203.0.113.10', 'user-agent': 'test' } });
  const ticketFingerprint = __test.requestFingerprint({ headers: { 'x-nf-client-connection-ip': '203.0.113.10', 'user-agent': 'test' } }, 'ticket-a');
  assert.match(tokenDigest, /^[0-9a-f]{64}$/);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(fingerprint, /203\.0\.113\.10/);
  assert.notEqual(ticketFingerprint, fingerprint);
});

test('validates UUIDs', () => {
  assert.equal(__test.uuid('11111111-1111-4111-8111-111111111111', 'ID'), '11111111-1111-4111-8111-111111111111');
  assert.throws(() => __test.uuid('nope', 'ID'), /invalid/);
});
