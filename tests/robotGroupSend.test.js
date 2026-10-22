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

test('buildMsgKeyAndParam builds sampleImageMsg payloads', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'image',
    photoURL: '@lADOABQ5abc',
  });

  assert.equal(result.msgKey, 'sampleImageMsg');
  assert.deepEqual(JSON.parse(result.msgParam), { photoURL: '@lADOABQ5abc' });
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

test('buildMsgKeyAndParam builds vertical multi-button actionCard payloads (sampleActionCard2~5)', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'actionCard',
    title: '标题',
    text: '内容',
    btns: 'vertical',
    buttons: {
      button: [
        { title: '按钮1', actionURL: 'https://example.com/1' },
        { title: '按钮2', actionURL: 'https://example.com/2' },
      ],
    },
  });

  assert.equal(result.msgKey, 'sampleActionCard2');
  assert.deepEqual(JSON.parse(result.msgParam), {
    title: '标题',
    text: '内容',
    actionTitle1: '按钮1',
    actionURL1: 'https://example.com/1',
    actionTitle2: '按钮2',
    actionURL2: 'https://example.com/2',
  });
});

test('buildMsgKeyAndParam builds horizontal two-button actionCard payloads (sampleActionCard6)', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'actionCard',
    title: '标题',
    text: '内容',
    btns: 'horizontal',
    buttonTitle1: '同意',
    buttonUrl1: 'https://example.com/yes',
    buttonTitle2: '拒绝',
    buttonUrl2: 'https://example.com/no',
  });

  assert.equal(result.msgKey, 'sampleActionCard6');
  assert.deepEqual(JSON.parse(result.msgParam), {
    title: '标题',
    text: '内容',
    buttonTitle1: '同意',
    buttonUrl1: 'https://example.com/yes',
    buttonTitle2: '拒绝',
    buttonUrl2: 'https://example.com/no',
  });
});

test('buildMsgKeyAndParam builds sampleAudio payloads with millisecond duration', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'audio',
    mediaId: '@IR_Pabc',
    duration: 3000,
  });

  assert.equal(result.msgKey, 'sampleAudio');
  assert.deepEqual(JSON.parse(result.msgParam), { mediaId: '@IR_Pabc', duration: '3000' });
});

test('buildMsgKeyAndParam builds sampleFile payloads', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'file',
    mediaId: '@lAzPabc',
    fileName: '表格.xlsx',
    fileType: 'xlsx',
  });

  assert.equal(result.msgKey, 'sampleFile');
  assert.deepEqual(JSON.parse(result.msgParam), {
    mediaId: '@lAzPabc',
    fileName: '表格.xlsx',
    fileType: 'xlsx',
  });
});

test('buildMsgKeyAndParam builds sampleVideo payloads and omits blank cover', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'video',
    videoMediaId: '$iQELabc',
    videoType: 'mp4',
    duration: 15,
    picMediaId: '',
  });

  assert.equal(result.msgKey, 'sampleVideo');
  assert.deepEqual(JSON.parse(result.msgParam), {
    duration: '15',
    videoMediaId: '$iQELabc',
    videoType: 'mp4',
  });
});

test('buildMsgKeyAndParam builds sampleVideo payloads with cover picture', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'video',
    videoMediaId: '$iQELabc',
    videoType: 'mp4',
    duration: 15,
    picMediaId: '$igEabc',
  });

  assert.deepEqual(JSON.parse(result.msgParam), {
    duration: '15',
    videoMediaId: '$iQELabc',
    videoType: 'mp4',
    picMediaId: '$igEabc',
  });
});

test('buildMsgKeyAndParam supports custom msgKey with object param', () => {
  const result = buildMsgKeyAndParam({
    msgtype: 'custom',
    customMsgKey: 'sampleImageMsg',
    customMsgParam: { photoURL: 'https://example.com/a.png' },
  });

  assert.equal(result.msgKey, 'sampleImageMsg');
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

test('collectMessageFormValues rejects vertical actionCard with wrong button count', () => {
  assert.throws(
    () =>
      collectMessageFormValues(makeParamsContext({
        msgtype: 'actionCard',
        btns: 'vertical',
        buttons: { button: [{ title: '仅一个', actionURL: 'https://example.com' }] },
      }), 0),
    /2到5个按钮/,
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
  assert.deepEqual(values, [
    'text',
    'link',
    'markdown',
    'image',
    'actionCard',
    'audio',
    'file',
    'video',
    'custom',
  ]);

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

test('robot.group.send sends file payload from form values', async () => {
  const { calls, context } = createContext(
    {
      robotCode: 'robot-1',
      openConversationId: 'cid-1',
      msgtype: 'file',
      mediaId: '{{ $json.media_id }}',
      fileName: 'report.xlsx',
      fileType: 'xlsx',
    },
    { processQueryKey: 'process-key-4' },
  );

  await groupSend.run.call(context, 0);

  assert.equal(calls[0].options.body.msgKey, 'sampleFile');
  assert.deepEqual(JSON.parse(calls[0].options.body.msgParam), {
    mediaId: '{{ $json.media_id }}',
    fileName: 'report.xlsx',
    fileType: 'xlsx',
  });
});

test('robot.oto.batchSend still posts to oToMessages/batchSend after refactor', async () => {
  const { calls, context } = createContext(
    {
      robotCode: 'robot-1',
      userIds: 'user001,user002',
      content: '单聊内容',
    },
    { processQueryKey: 'process-key-5' },
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

  assert.deepEqual(result.json, { processQueryKey: 'process-key-5' });
});
