const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildCreateTaskBody,
  buildUpdateTaskBody,
  normalizeOptionalTimestamp,
  splitCommaSeparatedValues,
} = require('../dist/nodes/DingtalkNode/resources/todo/common');
const createTodoTask = require('../dist/nodes/DingtalkNode/resources/todo/create').default;
const deleteTodoTask = require('../dist/nodes/DingtalkNode/resources/todo/delete').default;
const updateTodoTask = require('../dist/nodes/DingtalkNode/resources/todo/update').default;
const updateTodoTaskExecutorStatus =
  require('../dist/nodes/DingtalkNode/resources/todo/updateExecutorStatus').default;

function findProperty(operation, name) {
  const property = operation.properties.find((item) => item.name === name);
  assert.ok(property, `Expected ${operation.value} to expose ${name}`);
  return property;
}

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

test('buildUpdateTaskBody omits blank optional values and keeps false done status', () => {
  const body = buildUpdateTaskBody({
    subject: '  ',
    description: '',
    dueTime: '',
    detailUrl: '',
    executorIds: '',
    participantIds: '',
    priority: '',
    done: false,
  });

  assert.deepEqual(body, {
    done: false,
  });
});

test('buildUpdateTaskBody only includes fields supported by the DingTalk update API', () => {
  const body = buildUpdateTaskBody({
    subject: '更新后的标题',
    description: '更新后的描述',
    dueTime: 1784284200000,
    detailUrl: 'https://example.com/unsupported-on-update',
    pcDetailUrl: 'https://example.com/unsupported-on-update-pc',
    executorIds: ['uid1'],
    participantIds: ['uid2'],
    priority: 40,
    done: true,
  });

  assert.deepEqual(body, {
    subject: '更新后的标题',
    description: '更新后的描述',
    dueTime: 1784284200000,
    executorIds: ['uid1'],
    participantIds: ['uid2'],
    done: true,
  });
});

test('todo task required flags match DingTalk work todo metadata', () => {
  assert.equal(findProperty(createTodoTask, 'unionId').required, true);
  assert.equal(findProperty(createTodoTask, 'subject').required, true);
  assert.notEqual(findProperty(createTodoTask, 'sourceId').required, true);
  assert.notEqual(findProperty(createTodoTask, 'executorIds').required, true);
  assert.notEqual(findProperty(createTodoTask, 'detailUrl').required, true);

  assert.equal(findProperty(updateTodoTask, 'unionId').required, true);
  assert.equal(findProperty(updateTodoTask, 'taskId').required, true);
  for (const name of ['subject', 'description', 'dueTime', 'executorIds', 'participantIds']) {
    assert.notEqual(findProperty(updateTodoTask, name).required, true);
  }
  for (const name of ['detailUrl', 'pcDetailUrl', 'priority']) {
    assert.equal(
      updateTodoTask.properties.some((property) => property.name === name),
      false,
      `Expected ${name} to stay out of the update form`,
    );
  }

  for (const operation of [
    createTodoTask,
    updateTodoTask,
    deleteTodoTask,
    updateTodoTaskExecutorStatus,
  ]) {
    assert.notEqual(findProperty(operation, 'operatorId').required, true);
  }
});

test('normalizeOptionalTimestamp accepts milliseconds and ISO date strings', () => {
  assert.equal(normalizeOptionalTimestamp('1784284200000'), 1784284200000);
  assert.equal(normalizeOptionalTimestamp('2026-07-17T18:30:00+08:00'), 1784284200000);
  assert.equal(normalizeOptionalTimestamp(''), undefined);
});

test('splitCommaSeparatedValues supports commas and newlines', () => {
  assert.deepEqual(splitCommaSeparatedValues('a,b，c\n d '), ['a', 'b', 'c', 'd']);
});
