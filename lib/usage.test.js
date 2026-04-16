import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDailyUsageV2 } from './usage.js';

test('getDailyUsageV2 returns all expected fields', async () => {
  const data = await getDailyUsageV2({ days: 7 });
  assert.ok(Array.isArray(data.days));
  assert.equal(typeof data.monthTotal, 'number');
  assert.equal(typeof data.monthByModel, 'object');
  assert.ok(Array.isArray(data.byProject));
  assert.ok(Array.isArray(data.heatmap));
  assert.equal(typeof data.cacheRate, 'object');
  assert.equal(typeof data.cacheRate.pct, 'number');
  assert.equal(typeof data.workStyle, 'object');
  assert.equal(typeof data.workStyle.toolUse, 'number');
  assert.equal(typeof data.workStyle.endTurn, 'number');
  assert.ok(Array.isArray(data.toolUsage));
  assert.equal(typeof data.dailySessions, 'object');
  assert.equal(typeof data.monthSessions, 'number');
  assert.equal(typeof data.errors, 'object');
  assert.equal(typeof data.errors.total, 'number');
  assert.ok(Array.isArray(data.errors.byDate));
});

test('getDailyUsageV2 heatmap entries have dow and hour', async () => {
  const data = await getDailyUsageV2({ days: 7 });
  for (const entry of data.heatmap) {
    assert.ok(typeof entry.dow === 'number' && entry.dow >= 0 && entry.dow <= 6);
    assert.ok(typeof entry.hour === 'number' && entry.hour >= 0 && entry.hour <= 23);
    assert.equal(typeof entry.tokens, 'number');
  }
});

test('getDailyUsageV2 byProject sorted descending', async () => {
  const data = await getDailyUsageV2({ days: 30 });
  for (let i = 1; i < data.byProject.length; i++) {
    assert.ok(data.byProject[i - 1].tokens >= data.byProject[i].tokens);
  }
});

test('getDailyUsageV2 toolUsage sorted desc and max 10', async () => {
  const data = await getDailyUsageV2({ days: 30 });
  assert.ok(data.toolUsage.length <= 10);
  for (let i = 1; i < data.toolUsage.length; i++) {
    assert.ok(data.toolUsage[i - 1].count >= data.toolUsage[i].count);
  }
});

test('getDailyUsageV2 days include cost, sessions, errors', async () => {
  const data = await getDailyUsageV2({ days: 7 });
  for (const d of data.days) {
    assert.equal(typeof d.cost, 'number');
    assert.equal(typeof d.sessions, 'number');
    assert.equal(typeof d.errors, 'number');
  }
});
