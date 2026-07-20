const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildCreateTaskBody,
  buildUpdateTaskBody,
  normalizeOptionalTimestamp,
  splitCommaSeparatedValues,
} = require('../dist/nodes/DingtalkNode/resources/todo/common');

test('buildCreateTaskBody maps form values to DingTalk task payload', () => {
  const body = buildCreateTaskBody({
    sourceId: 'source-1',
    subject: '提交周报',
    description: '周五前完成',
    dueTime: '2026-07-17T18:30:00+08:00',
    detailUrl: 'https://example.com/task/source-1',
    executorIds: 'uid1, uid2',
    participantIds: ' uid3\nuid4 ',
    priority: 40,
  });

  assert.deepEqual(body, {
    sourceId: 'source-1',
    subject: '提交周报',
    description: '周五前完成',
    dueTime: 1784284200000,
    detailUrl: {
      appUrl: 'https://example.com/task/source-1',
      pcUrl: 'https://example.com/task/source-1',
    },
    executorIds: ['uid1', 'uid2'],
    participantIds: ['uid3', 'uid4'],
    priority: 40,
  });
});

test('buildUpdateTaskBody omits unsupported and blank values and keeps false done status', () => {
  const body = buildUpdateTaskBody({
    subject: '  ',
    description: '',
    dueTime: '',
    detailUrl: 'https://example.com/task/source-1',
    executorIds: '',
    participantIds: '',
    priority: 40,
    done: false,
  });

  assert.deepEqual(body, {
    done: false,
  });
});

test('normalizeOptionalTimestamp accepts milliseconds and ISO date strings', () => {
  assert.equal(normalizeOptionalTimestamp('1784284200000'), 1784284200000);
  assert.equal(normalizeOptionalTimestamp('2026-07-17T18:30:00+08:00'), 1784284200000);
  assert.equal(normalizeOptionalTimestamp(''), undefined);
});

test('splitCommaSeparatedValues supports commas and newlines', () => {
  assert.deepEqual(splitCommaSeparatedValues('a,b，c\n d '), ['a', 'b', 'c', 'd']);
});
