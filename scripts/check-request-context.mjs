import assert from 'node:assert/strict';
import {hasSameOrigin, requestClientIp} from '../lib/request-context.ts';

const publicUrl = 'https://navigator.example';
const proxied = new Request('http://0.0.0.0:3000/api/ask', {
  headers: {origin: publicUrl, 'x-real-ip': '192.0.2.1', 'cf-connecting-ip': '198.51.100.2'},
});
assert.equal(hasSameOrigin(proxied, publicUrl), true);
assert.equal(hasSameOrigin(proxied, 'https://another.example'), false);
assert.equal(hasSameOrigin(proxied, 'not a URL'), false);
assert.equal(hasSameOrigin(new Request(publicUrl), publicUrl), false);
assert.equal(hasSameOrigin(new Request(publicUrl, {headers: {origin: publicUrl}}), ''), true);
assert.equal(hasSameOrigin(new Request(publicUrl, {headers: {
  origin: 'https://untrusted.example', 'x-forwarded-host': 'untrusted.example',
}}), publicUrl), false);
assert.equal(requestClientIp(proxied, true), '192.0.2.1');
assert.equal(requestClientIp(proxied, false), '198.51.100.2');
assert.equal(requestClientIp(new Request(publicUrl), true), 'anonymous');
console.log('PASS: public HTTPS origin behind Railway, rejected foreign origins, and platform client-IP headers.');
