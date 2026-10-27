const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const workflow = JSON.parse(readFileSync(
  join(__dirname, '../examples/基础_机器人发送群聊消息_v0.11.0.json'), 'utf8',
));

test('group-message example uses filePath for Read Binary File', () => {
  const reader = workflow.nodes.find((node) => node.type === 'n8n-nodes-base.readBinaryFile');
  assert.ok(reader);
  assert.equal(reader.parameters.filePath, '/path/to/report.xlsx');
  assert.equal(reader.parameters.fileName, undefined);
});

test('group-message example preserves fileName for DingTalk upload and send', () => {
  const upload = workflow.nodes.find((node) => node.parameters.operation === 'robot.media.upload');
  const send = workflow.nodes.find((node) =>
    node.parameters.operation === 'robot.group.send' && node.parameters.msgtype === 'file',
  );
  assert.ok(upload);
  assert.ok(send);
  assert.equal(upload.parameters.fileName, 'report.xlsx');
  assert.equal(send.parameters.fileName, 'report.xlsx');
});
