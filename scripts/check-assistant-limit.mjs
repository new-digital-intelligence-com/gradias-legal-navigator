import assert from 'node:assert/strict';
import {createAssistantLimiter} from '../lib/assistant-rate-limit.ts';
let time=0;const limiter=createAssistantLimiter(()=>time);
for(let i=0;i<6;i++){const release=limiter.acquire('visitor');assert.ok(release);release();release();}
assert.equal(limiter.acquire('visitor'),null);
time=60_000;const slots=Array.from({length:4},(_,i)=>limiter.acquire('visitor-'+i));slots.forEach(s=>assert.ok(s));
assert.equal(limiter.acquire('fifth'),null);slots.forEach(s=>s());
assert.ok(limiter.acquire('visitor'));
const global=createAssistantLimiter(()=>time);
for(let i=0;i<30;i++){const release=global.acquire('visitor-'+i);assert.ok(release);release();}
assert.equal(global.acquire('visitor-31'),null);
console.log('PASS: per-visitor, aggregate, concurrent, window-reset and release limits.');
