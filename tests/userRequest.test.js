const assert = require('node:assert/strict');
const test = require('node:test');
const { NodeHelpers } = require('n8n-workflow');

const { DingtalkNode } = require('../dist/nodes/DingtalkNode/DingtalkNode.node');
const user = require('../dist/nodes/DingtalkNode/resources/user').default;
const operations = new Map(user.operations.map((op) => [op.value, op]));

function createContext(parameters, responses) {
  const items = Array.isArray(parameters) ? parameters : [parameters];
  const calls = [];
  return {
    calls,
    context: {
      getNodeParameter(name, itemIndex, fallback) {
        return Object.hasOwn(items[itemIndex], name) ? items[itemIndex][name] : fallback;
      },
      getInputData: () => items.map(() => ({ json: {} })),
      prepareOutputData: (output) => [output],
      continueOnFail: () => false,
      getNode: () => ({
        id: 'user-test',
        name: 'DingTalk User',
        type: 'CUSTOM.dingtalkNode',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      }),
      getCredentials: async () => ({ accessToken: 'test-token' }),
      helpers: {
        async httpRequestWithAuthentication(credentialType, options) {
          calls.push({ credentialType, options });
          return responses[Math.min(calls.length - 1, responses.length - 1)];
        },
      },
      logger: { debug() {}, error() {} },
    },
  };
}

test('new user operations expose the documented required fields and page limits', () => {
  const required = (value) =>
    operations
      .get(value)
      .properties.filter((p) => p.required)
      .map((p) => p.name)
      .sort();
  assert.deepEqual(required('user.listLeaveRecords'), ['maxResults', 'startTime']);
  assert.deepEqual(required('user.listDepartmentUsers'), ['cursor', 'deptId', 'size']);
  assert.deepEqual(required('user.listDepartmentUserIds'), ['deptId']);
  assert.equal(
    operations.get('user.listLeaveRecords').properties.find((p) => p.name === 'maxResults')
      .typeOptions.maxValue,
    50,
  );
  assert.equal(
    operations.get('user.listDepartmentUsers').properties.find((p) => p.name === 'size').typeOptions
      .maxValue,
    100,
  );
  const node = new DingtalkNode();
  for (const value of [
    'user.listLeaveRecords',
    'user.listDepartmentUsers',
    'user.listDepartmentUserIds',
  ]) {
    const properties = node.description.properties.filter((p) =>
      p.displayOptions?.show?.operation?.includes(value),
    );
    assert.ok(properties.length > 0);
    for (const p of properties) assert.deepEqual(p.displayOptions.show.resource, ['user']);
  }
});

test('leave records use UTC second query parameters and preserve opaque page tokens', async () => {
  const parameters = {
    startTime: '2026-11-01T00:00:00.123+08:00',
    endTime: '2026-11-10T23:59:59.999+08:00',
    nextToken: '9007199254740993123',
    maxResults: 1,
  };
  const response = { nextToken: 'next-page', records: [{ userId: 'former-employee' }] };
  const { context, calls } = createContext(parameters, [response]);
  const out = await operations.get('user.listLeaveRecords').run.call(context, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentialType, 'dingtalkApi');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.baseURL, 'https://api.dingtalk.com/v1.0');
  assert.equal(calls[0].options.url, '/contact/empLeaveRecords');
  assert.deepEqual(calls[0].options.qs, {
    ...parameters,
    startTime: '2026-10-31T16:00:00Z',
    endTime: '2026-11-10T15:59:59Z',
  });
  assert.equal(calls[0].options.body, undefined);
  assert.deepEqual(out, { json: response, pairedItem: { item: 0 } });
});

for (const [label, optional, expectedToken] of [
  ['defaults', {}, '0'],
  ['blank optional values', { endTime: '', nextToken: '' }, undefined],
]) {
  test(`leave records omit an unset end time with ${label}`, async () => {
    const response = { records: [] };
    const { context, calls } = createContext(
      { startTime: '2026-11-01T00:00:00.456Z', ...optional },
      [response],
    );
    const out = await operations.get('user.listLeaveRecords').run.call(context, 0);
    const expected = { startTime: '2026-11-01T00:00:00Z', maxResults: 50 };
    if (expectedToken !== undefined) expected.nextToken = expectedToken;
    assert.deepEqual(calls[0].options.qs, expected);
    assert.deepEqual(out.json, response);
  });
}

test('department user basics pass pagination, sorting, language and access-limit options to oapi', async () => {
  const response = {
    errcode: 0,
    result: {
      list: [{ userid: 'employee-1', name: 'Employee' }],
      has_more: true,
      next_cursor: 120,
    },
  };
  const { context, calls } = createContext(
    {
      deptId: '42',
      cursor: 100,
      size: 20,
      orderField: 'modify_desc',
      containAccessLimit: true,
      language: 'en_US',
    },
    [response],
  );
  const out = await operations.get('user.listDepartmentUsers').run.call(context, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.url, 'https://oapi.dingtalk.com/topapi/user/listsimple');
  assert.equal(calls[0].options.baseURL, undefined);
  assert.deepEqual(calls[0].options.body, {
    dept_id: 42,
    cursor: 100,
    size: 20,
    order_field: 'modify_desc',
    contain_access_limit: true,
    language: 'en_US',
  });
  assert.deepEqual(out, { json: response, pairedItem: { item: 0 } });
});

test('n8n resolves department user defaults without losing false or cursor zero', async () => {
  const node = new DingtalkNode();
  const parameters = NodeHelpers.getNodeParameters(
    node.description.properties,
    { resource: 'user', operation: 'user.listDepartmentUsers', deptId: '1' },
    true,
    false,
    { typeVersion: 1 },
    node.description,
  );
  const { context, calls } = createContext(parameters, [{ errcode: 0, result: { list: [] } }]);
  await operations.get('user.listDepartmentUsers').run.call(context, 0);
  assert.deepEqual(calls[0].options.body, {
    dept_id: 1,
    cursor: 0,
    size: 10,
    order_field: 'custom',
    contain_access_limit: false,
    language: 'zh_CN',
  });
});

test('department user IDs only send the department ID and preserve empty results', async () => {
  const response = { errcode: 0, errmsg: 'ok', result: { userid_list: [] } };
  const { context, calls } = createContext({ deptId: '42' }, [response]);
  const out = await operations.get('user.listDepartmentUserIds').run.call(context, 0);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.url, 'https://oapi.dingtalk.com/topapi/user/listid');
  assert.deepEqual(calls[0].options.body, { dept_id: 42 });
  assert.deepEqual(out, { json: response, pairedItem: { item: 0 } });
});

test('user ID requests execute per input item and preserve item pairing', async () => {
  const responses = [
    { errcode: 0, result: { userid_list: ['employee-1'] } },
    { errcode: 0, result: { userid_list: ['employee-2'] } },
  ];
  const { context, calls } = createContext(
    [
      { operation: 'user.listDepartmentUserIds', deptId: '42' },
      { operation: 'user.listDepartmentUserIds', deptId: '43' },
    ],
    responses,
  );
  const output = await new DingtalkNode().execute.call(context);
  assert.deepEqual(
    calls.map((call) => call.options.body.dept_id),
    [42, 43],
  );
  assert.deepEqual(output, [responses.map((json, item) => ({ json, pairedItem: { item } }))]);
});
