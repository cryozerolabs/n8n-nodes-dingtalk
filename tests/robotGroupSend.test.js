const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildMsgKeyAndParam,
  collectMessageFormValues,
} = require('../dist/nodes/DingtalkNode/resources/robot/common');
const batchSend = require('../dist/nodes/DingtalkNode/resources/robot/batchSend').default;
const groupSend = require('../dist/nodes/DingtalkNode/resources/robot/groupSend').default;

function findFormProperty(operation, name) {
  // bodyProps 会给表单字段追加 sendBody: ['form'] 显示条件，这里按名称查找即可
  const property = operation.properties.find((item) => item.name === name);
  assert.ok(property, `Expected ${operation.value} to expose ${name}`);
  return property;
}

function makeParamsContext(params) {
  return {
    getNodeParameter(name, _itemIndex, fallback) {
      if (name in params) return params[name];
      return fallback;
    },
    getNode() {
      return {
        id: 'test-node',
        name: 'Test DingTalk Node',
        type: 'test.dingtalk',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      };
    },
  };
}

function createContext(params, response) {
  const calls = [];

  return {
    calls,
    context: {
      getNodeParameter(name, _itemIndex, fallback) {
        if (name in params) return params[name];
        return fallback;
      },
      getNode() {
        return {
          id: 'test-node',
          name: 'Test DingTalk Node',
          type: 'test.dingtalk',
          typeVersion: 1,
          position: [0, 0],
          parameters: {},
        };
      },
      async getCredentials() {
        return {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          accessToken: 'token',
        };
      },
      helpers: {
        async httpRequestWithAuthentication(credentialType, options) {
          calls.push({ credentialType, options });
          return response;
        },
      },
      logger: {
        debug() {},
        error() {},
      },
    },
  };
}

test('buildMsgKeyAndParam builds sampleText payloads', () => {
  const result = buildMsgKeyAndParam({ msgtype: 'text', content: 'hello' });

  assert.deepEqual(result, {
    msgKey: 'sampleText',
    msgParam: '{"content":"hello"}',
  });
});

test('buildMsgKeyAndParam builds sampleMarkdown payloads', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'markdown',
    title: '标题',
    text: '# 内容',
  });

  assert.equal(result.msgKey, 'sampleMarkdown');
  assert.deepEqual(JSON.parse(result.msgParam), { title: '标题', text: '# 内容' });
});

test('buildMsgKeyAndParam builds sampleLink payloads', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'link',
    title: '标题',
    text: '内容',
    messageUrl: 'https://example.com',
    picUrl: 'https://example.com/a.png',
  });

  assert.equal(result.msgKey, 'sampleLink');
  assert.deepEqual(JSON.parse(result.msgParam), {
    title: '标题',
    text: '内容',
    messageUrl: 'https://example.com',
    picUrl: 'https://example.com/a.png',
  });
});

test('buildMsgKeyAndParam builds single-button sampleActionCard payloads', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'actionCard',
    title: '标题',
    text: '内容',
    btns: 'single',
    singleTitle: '阅读全文',
    singleURL: 'https://example.com',
  });

  assert.equal(result.msgKey, 'sampleActionCard');
  assert.deepEqual(JSON.parse(result.msgParam), {
    title: '标题',
    text: '内容',
    singleTitle: '阅读全文',
    singleURL: 'https://example.com',
  });
});

test('buildMsgKeyAndParam builds multi-button sampleActionCard payloads', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'actionCard',
    title: '标题',
    text: '内容',
    btns: 'btns',
    btnOrientation: 1,
    buttons: {
      button: [
        { title: '按钮1', actionURL: 'https://example.com/1' },
        { title: '按钮2', actionURL: 'https://example.com/2' },
      ],
    },
  });

  assert.equal(result.msgKey, 'sampleActionCard');
  assert.deepEqual(JSON.parse(result.msgParam), {
    title: '标题',
    text: '内容',
    btnOrientation: '1',
    btns: [
      { title: '按钮1', actionURL: 'https://example.com/1' },
      { title: '按钮2', actionURL: 'https://example.com/2' },
    ],
  });
});

test('buildMsgKeyAndParam builds sampleFeedCard payloads', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'feedCard',
    links: {
      link: [
        { title: '链接1', messageURL: 'https://example.com/1', picURL: 'https://e.com/1.png' },
      ],
    },
  });

  assert.equal(result.msgKey, 'sampleFeedCard');
  assert.deepEqual(JSON.parse(result.msgParam), {
    links: [
      { title: '链接1', messageURL: 'https://example.com/1', picURL: 'https://e.com/1.png' },
    ],
  });
});

test('buildMsgKeyAndParam supports custom msgKey with object param', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'custom',
    customMsgKey: 'sampleImage',
    customMsgParam: { photoURL: 'https://example.com/a.png' },
  });

  assert.equal(result.msgKey, 'sampleImage');
  assert.equal(result.msgParam, '{"photoURL":"https://example.com/a.png"}');
});

test('collectMessageFormValues accepts valid JSON string as custom param', () => {
  const values = collectMessageFormValues(makeParamsContext({
    msgtype: 'custom',
    customMsgKey: 'sampleText',
    customMsgParam: '{ "content" : "hello" }',
  }), 0);

  const result = buildMsgKeyAndParam(values);

  assert.equal(result.msgKey, 'sampleText');
  assert.equal(result.msgParam, '{"content":"hello"}');
});

test('collectMessageFormValues rejects invalid custom param JSON', () => {
  assert.throws(
    () =>
      collectMessageFormValues(makeParamsContext({
        msgtype: 'custom',
        customMsgKey: 'sampleText',
        customMsgParam: '{not json}',
      }), 0),
    /不是合法的 JSON/,
  );
});

test('collectMessageFormValues rejects non-object custom param', () => {
  assert.throws(
    () =>
      collectMessageFormValues(makeParamsContext({
        msgtype: 'custom',
        customMsgKey: 'sampleText',
        customMsgParam: '"just a string"',
      }), 0),
    /必须为 JSON 对象/,
  );
});

test('robot.group.send operation is registered with expected properties', () => {
  assert.equal(groupSend.value, 'robot.group.send');
  assert.equal(groupSend.name, '机器人发送群聊消息');

  assert.equal(findFormProperty(groupSend, 'robotCode').required, true);
  assert.equal(findFormProperty(groupSend, 'openConversationId').required, true);
  assert.equal(findFormProperty(groupSend, 'coolAppCode').required, undefined);

  const msgtype = findFormProperty(groupSend, 'msgtype');
  const values = msgtype.options.map((option) => option.value);
  assert.deepEqual(values, ['text', 'link', 'markdown', 'actionCard', 'feedCard', 'custom']);

  // JSON 模式默认请求体应包含群聊接口的关键字段
  const jsonBody = findFormProperty(groupSend, 'jsonBody').default;
  const parsed = JSON.parse(jsonBody);
  assert.ok(parsed.openConversationId);
  assert.ok(parsed.robotCode);
  assert.ok(parsed.msgKey);
  assert.ok(parsed.msgParam);
});

test('robot.group.send posts to groupMessages/send with text payload', async () => {
  const { calls, context } = createContext(
    {
      robotCode: 'robot-1',
      openConversationId: 'cid-1',
      content: 'hello 群消息',
    },
    { processQueryKey: 'process-key-1' },
  );

  const result = await groupSend.run.call(context, 0);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentialType, 'dingtalkApi');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.url, '/robot/groupMessages/send');
  assert.equal(calls[0].options.baseURL, 'https://api.dingtalk.com/v1.0');
  assert.deepEqual(calls[0].options.body, {
    robotCode: 'robot-1',
    openConversationId: 'cid-1',
    msgKey: 'sampleText',
    msgParam: '{"content":"hello 群消息"}',
  });
  // 未填写酷应用编码时不应携带 coolAppCode
  assert.ok(!('coolAppCode' in calls[0].options.body));

  assert.deepEqual(result.json, { processQueryKey: 'process-key-1' });
  assert.deepEqual(result.pairedItem, { item: 0 });
});

test('robot.group.send includes coolAppCode when provided', async () => {
  const { calls, context } = createContext(
    {
      robotCode: 'robot-1',
      openConversationId: 'cid-1',
      coolAppCode: 'cool-1',
      content: 'hello',
    },
    { processQueryKey: 'process-key-2' },
  );

  await groupSend.run.call(context, 0);

  assert.equal(calls[0].options.body.coolAppCode, 'cool-1');
});

test('robot.group.send sends markdown payload from form values', async () => {
  const { calls, context } = createContext(
    {
      robotCode: 'robot-1',
      openConversationId: 'cid-1',
      msgtype: 'markdown',
      title: '标题',
      text: '# 内容',
    },
    { processQueryKey: 'process-key-3' },
  );

  await groupSend.run.call(context, 0);

  assert.equal(calls[0].options.body.msgKey, 'sampleMarkdown');
  assert.deepEqual(JSON.parse(calls[0].options.body.msgParam), { title: '标题', text: '# 内容' });
});

test('robot.oto.batchSend still posts to oToMessages/batchSend after refactor', async () => {
  const { calls, context } = createContext(
    {
      robotCode: 'robot-1',
      userIds: 'user001,user002',
      content: '单聊内容',
    },
    { processQueryKey: 'process-key-4' },
  );

  const result = await batchSend.run.call(context, 0);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.url, '/robot/oToMessages/batchSend');
  assert.deepEqual(calls[0].options.body, {
    robotCode: 'robot-1',
    userIds: ['user001', 'user002'],
    msgKey: 'sampleText',
    msgParam: '{"content":"单聊内容"}',
  });

  assert.deepEqual(result.json, { processQueryKey: 'process-key-4' });
});
