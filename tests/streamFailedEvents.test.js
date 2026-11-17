const assert = require('node:assert/strict');
const test = require('node:test');

const { DingtalkNode } = require('../dist/nodes/DingtalkNode/DingtalkNode.node');
const stream = require('../dist/nodes/DingtalkNode/resources/stream').default;

function createContext(responses) {
  const calls = [];
  return {
    calls,
    context: {
      getNodeParameter: (name, _itemIndex, fallback) =>
        name === 'operation' ? 'stream.getFailedEvents' : fallback,
      getInputData: () => [{ json: {} }],
      prepareOutputData: (output) => [output],
      continueOnFail: () => false,
      getNode: () => ({
        id: 'failed-events-test',
        name: 'DingTalk Failed Events',
        type: 'CUSTOM.dingtalkNode',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      }),
      getCredentials: async () => ({ accessToken: 'test-token' }),
      helpers: {
        async httpRequestWithAuthentication(credentialType, options) {
          calls.push({ credentialType, options });
          assert.ok(calls.length <= responses.length, 'must not fetch another batch automatically');
          return responses[calls.length - 1];
        },
      },
      logger: { debug() {}, error() {} },
    },
  };
}

test('failed event retrieval joins the existing resource without changing response credentials or defaults', () => {
  const node = new DingtalkNode();
  const operation = node.description.properties.find(
    (p) => p.name === 'operation' && p.displayOptions?.show?.resource?.includes('stream'),
  );
  assert.equal(operation.default, '');
  assert.ok(operation.options.some((o) => o.value === 'stream.getFailedEvents'));
  assert.ok(operation.options.some((o) => o.value === 'stream.respond'));
  const credential = node.description.credentials.find((c) => c.name === 'dingtalkApi');
  assert.equal(credential.required, true);
  assert.equal(credential.displayOptions.hide.operation.includes('stream.getFailedEvents'), false);
  assert.ok(credential.displayOptions.hide.operation.includes('stream.respond'));
  const notice = stream.properties.find((p) => p.name === 'failedEventsNotice');
  assert.deepEqual(notice.displayOptions.show, {
    operation: ['stream.getFailedEvents'],
    resource: ['stream'],
  });
});

for (const moreKey of ['has_more', 'hasMore']) {
  test(`retrieves one authenticated batch and preserves ${moreKey} and event data`, async () => {
    const response = {
      errcode: 0,
      errmsg: 'ok',
      [moreKey]: true,
      failed_list: [
        {
          call_back_tag: 'org_dept_modify',
          org_dept_modify: { corpid: 'test-corp', deptid: [42] },
          event_time: 1794883868000,
        },
      ],
    };
    const { context, calls } = createContext([response]);
    const out = await new DingtalkNode().execute.call(context);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].credentialType, 'dingtalkApi');
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(
      calls[0].options.url,
      'https://oapi.dingtalk.com/call_back/get_call_back_failed_result',
    );
    assert.equal(calls[0].options.body, undefined);
    assert.equal(calls[0].options.qs, undefined);
    assert.deepEqual(out, [[{ json: response, pairedItem: { item: 0 } }]]);
  });
}

test('an empty failed list still returns the original response for downstream conditions', async () => {
  const response = { errcode: 0, errmsg: 'ok', hasMore: false, failed_list: [] };
  const { context, calls } = createContext([response]);
  assert.deepEqual(await new DingtalkNode().execute.call(context), [
    [{ json: response, pairedItem: { item: 0 } }],
  ]);
  assert.equal(calls.length, 1);
});

test('failed event retrieval follows per-item execution and item pairing', async () => {
  const responses = [
    { errcode: 0, hasMore: true, failed_list: [{ call_back_tag: 'org_dept_create' }] },
    { errcode: 0, hasMore: false, failed_list: [] },
  ];
  const { context, calls } = createContext(responses);
  context.getInputData = () => [{ json: {} }, { json: {} }];
  const out = await new DingtalkNode().execute.call(context);
  assert.equal(calls.length, 2);
  assert.deepEqual(out, [responses.map((json, item) => ({ json, pairedItem: { item } }))]);
});

test('API errors are surfaced instead of being returned as an empty failed list', async () => {
  const { context, calls } = createContext([{ errcode: 88, errmsg: '没有权限获取失败事件' }]);
  await assert.rejects(new DingtalkNode().execute.call(context));
  assert.equal(calls.length, 1);
});
