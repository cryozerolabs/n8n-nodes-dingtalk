const assert = require('node:assert/strict');
const test = require('node:test');

const recordInsert = require('../dist/nodes/DingtalkNode/resources/notable/recordInsert').default;

const UUID_V4 = '550e8400-e29b-41d4-a716-446655440000';

function findProperty(name) {
  const property = recordInsert.properties.find((item) => item.name === name);
  assert.ok(property, `Expected ${recordInsert.value} to expose ${name}`);
  return property;
}

async function executeRecordInsert(clientToken, sendBody = 'form') {
  const calls = [];
  const fields = { 标题: '测试记录' };
  const requestBody = { records: [{ fields }] };
  const parameters = {
    overrideOperator: false,
    baseId: 'base-1',
    sheetIdOrName: 'sheet-1',
    clientToken,
    sendBody,
    jsonBody: requestBody,
    'columns.mappingMode': 'defineBelow',
    'columns.value': fields,
  };
  const context = {
    getNodeParameter(name, _itemIndex, defaultValue) {
      return Object.hasOwn(parameters, name) ? parameters[name] : defaultValue;
    },
    async getCredentials() {
      return {
        userUnionId: 'operator-1',
        accessToken: 'valid-token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      };
    },
    getNode() {
      return {
        id: 'test-node',
        name: 'Insert DingTalk Record',
        type: 'CUSTOM.dingtalkNode',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      };
    },
    getInputData() {
      return [{ json: fields }];
    },
    helpers: {
      async httpRequestWithAuthentication(credentialType, options, authentication) {
        calls.push({ credentialType, options, authentication });
        return { value: [{ id: 'record-1' }] };
      },
    },
    logger: {
      debug() {},
      error() {},
    },
  };

  const result = await recordInsert.run.call(context, 0);
  return { calls, requestBody, result };
}

test('exposes clientToken as an optional parameter for both body modes', () => {
  const property = findProperty('clientToken');

  assert.equal(property.type, 'string');
  assert.equal(property.default, '');
  assert.notEqual(property.required, true);
  assert.deepEqual(property.displayOptions, {
    show: { operation: ['notable.record.insert'] },
  });
});

test('sends a non-empty clientToken in the insert-records query', async () => {
  const { calls, requestBody, result } = await executeRecordInsert(`  ${UUID_V4}  `);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentialType, 'dingtalkApi');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.baseURL, 'https://api.dingtalk.com/v1.0');
  assert.equal(calls[0].options.url, '/notable/bases/base-1/sheets/sheet-1/records');
  assert.deepEqual(calls[0].options.qs, {
    operatorId: 'operator-1',
    clientToken: UUID_V4,
  });
  assert.deepEqual(calls[0].options.body, requestBody);
  assert.deepEqual(result, {
    json: { value: [{ id: 'record-1' }] },
    pairedItem: { item: 0 },
  });
});

test('omits a blank clientToken from the insert-records query', async () => {
  const { calls, requestBody } = await executeRecordInsert('   ');

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options.qs, { operatorId: 'operator-1' });
  assert.deepEqual(calls[0].options.body, requestBody);
  assert.equal(Object.hasOwn(calls[0].options.body, 'clientToken'), false);
});

test('keeps clientToken in the query when JSON body mode is used', async () => {
  const { calls, requestBody } = await executeRecordInsert(UUID_V4, 'json');

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options.qs, {
    operatorId: 'operator-1',
    clientToken: UUID_V4,
  });
  assert.deepEqual(calls[0].options.body, requestBody);
});
