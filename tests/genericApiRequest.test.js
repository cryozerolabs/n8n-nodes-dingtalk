const assert = require('node:assert/strict');
const test = require('node:test');

const { DingtalkApi } = require('../dist/credentials/DingtalkApi.credentials');
const { DingtalkNode } = require('../dist/nodes/DingtalkNode/DingtalkNode.node');
const apiRequestModule = require('../dist/nodes/DingtalkNode/resources/api/request');

const apiRequest = apiRequestModule.default;
const { resolveDingTalkUrl } = apiRequestModule;

function createContext(parameters, responses) {
  const calls = [];

  return {
    calls,
    context: {
      getNodeParameter(name, _itemIndex, defaultValue) {
        return Object.hasOwn(parameters, name) ? parameters[name] : defaultValue;
      },
      async getCredentials() {
        return {
          clientId: 'client-id',
          clientSecret: 'client-secret',
          accessToken: 'stale-token',
        };
      },
      getNode() {
        return {
          id: 'test-node',
          name: 'DingTalk Custom API Request',
          type: 'CUSTOM.dingtalkNode',
          typeVersion: 1,
          position: [0, 0],
          parameters: {},
        };
      },
      helpers: {
        async httpRequestWithAuthentication(credentialType, options, authentication) {
          calls.push({ credentialType, options, authentication });
          const response = responses[calls.length - 1];
          if (response instanceof Error) throw response;
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

function baseParameters(overrides = {}) {
  return {
    method: 'GET',
    url: 'https://api.dingtalk.com/v1.0/contact/users/me',
    queryParameters: {},
    headers: {},
    sendBody: false,
    jsonBody: {},
    ...overrides,
  };
}

test('registers the custom API resource and request operation', () => {
  const node = new DingtalkNode();
  const resource = node.description.properties.find((property) => property.name === 'resource');
  const operation = node.description.properties.find(
    (property) =>
      property.name === 'operation' && property.displayOptions?.show?.resource?.includes('api'),
  );

  assert.ok(
    resource.options.some(
      (option) => option.value === 'api' && option.name === '自定义 API 请求',
    ),
  );
  const requestOption = operation.options.find((option) => option.value === 'api.request');
  assert.ok(requestOption);
  assert.equal(requestOption.action, '自定义 API 请求');
  assert.equal(apiRequest.value, 'api.request');
  assert.equal(apiRequest.action, '自定义 API 请求');
  assert.ok(apiRequest.properties.some((property) => property.name === 'url'));
  for (const removedName of ['urlMode', 'apiType', 'path', 'fullUrl']) {
    assert.equal(apiRequest.properties.some((property) => property.name === removedName), false);
  }
});

test('restricts access-token refresh requests to the official API domain', async () => {
  const calls = [];
  const credential = new DingtalkApi();
  const result = await credential.preAuthentication.call(
    {
      helpers: {
        async httpRequest(options) {
          calls.push(options);
          return { accessToken: 'fresh-token' };
        },
      },
    },
    { clientId: 'client-id', clientSecret: 'client-secret' },
  );

  assert.deepEqual(result, { accessToken: 'fresh-token' });
  assert.equal(calls[0].allowedDomains, 'api.dingtalk.com');
  assert.equal(calls[0].disableFollowRedirect, undefined);
  assert.equal(calls[0].sendCredentialsOnCrossOriginRedirect, undefined);
});

test('injects the access token according to the exact DingTalk hostname', async () => {
  const credential = new DingtalkApi();
  const credentials = { accessToken: 'credential-token' };

  const modern = await credential.authenticate(credentials, {
    method: 'GET',
    url: 'https://api.dingtalk.com/v1.0/example?next=oapi.dingtalk.com&ACCESS_TOKEN=url-token',
    qs: { Access_Token: 'query-token', language: 'zh_CN' },
    headers: { 'X-Acs-Dingtalk-Access-Token': 'header-token', 'x-request-id': 'request-1' },
  });
  assert.equal(modern.headers['x-acs-dingtalk-access-token'], 'credential-token');
  assert.equal(modern.qs?.access_token, undefined);
  assert.equal(modern.qs?.Access_Token, undefined);
  assert.equal(modern.qs?.language, 'zh_CN');
  assert.equal(modern.headers['X-Acs-Dingtalk-Access-Token'], undefined);
  assert.equal(modern.headers['x-request-id'], 'request-1');
  assert.equal(new URL(modern.url).searchParams.has('ACCESS_TOKEN'), false);

  const relativeModern = await credential.authenticate(credentials, {
    method: 'GET',
    baseURL: 'https://api.dingtalk.com/v1.0',
    url: '/contact/users/me',
  });
  assert.equal(relativeModern.url, '/contact/users/me');
  assert.equal(
    relativeModern.headers['x-acs-dingtalk-access-token'],
    'credential-token',
  );

  const legacy = await credential.authenticate(credentials, {
    method: 'GET',
    url: 'https://oapi.dingtalk.com/topapi/v2/user/get?access_token=url-token',
    qs: { ACCESS_TOKEN: 'query-token' },
    headers: { 'X-ACS-DINGTALK-ACCESS-TOKEN': 'header-token' },
  });
  assert.equal(legacy.qs.access_token, 'credential-token');
  assert.equal(legacy.qs.ACCESS_TOKEN, undefined);
  assert.equal(legacy.headers?.['x-acs-dingtalk-access-token'], undefined);
  assert.equal(legacy.headers?.['X-ACS-DINGTALK-ACCESS-TOKEN'], undefined);
  assert.equal(new URL(legacy.url).searchParams.has('access_token'), false);

  await assert.rejects(
    credential.authenticate(credentials, {
      method: 'GET',
      url: 'https://example.com/api',
    }),
    /只允许访问/,
  );
});

test('builds a modern DingTalk JSON request with query, headers, and body', async () => {
  const body = { robotCode: 'robot-code', userIds: ['user-1'] };
  const { calls, context } = createContext(
    baseParameters({
      method: 'POST',
      url: 'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
      queryParameters: {
        parameters: [
          { name: 'cursor', value: '0' },
          { name: 'size', value: '20' },
        ],
      },
      headers: {
        parameters: [{ name: 'x-request-id', value: 'request-1' }],
      },
      sendBody: true,
      jsonBody: body,
    }),
    [{ success: true }],
  );

  const result = await apiRequest.run.call(context, 0);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentialType, 'dingtalkApi');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(
    calls[0].options.url,
    'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
  );
  assert.deepEqual(calls[0].options.qs, { cursor: '0', size: '20' });
  assert.deepEqual(calls[0].options.body, body);
  assert.equal(calls[0].options.headers['x-request-id'], 'request-1');
  assert.equal(calls[0].options.disableFollowRedirect, undefined);
  assert.equal(calls[0].options.sendCredentialsOnCrossOriginRedirect, undefined);
  assert.equal(calls[0].options.allowedDomains, 'api.dingtalk.com,oapi.dingtalk.com');
  assert.deepEqual(result, {
    json: { success: true },
    pairedItem: { item: 0 },
  });
});

test('refreshes once after a legacy API 40014 response', async () => {
  const { calls, context } = createContext(
    baseParameters({
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/user/getbymobile',
      sendBody: true,
      jsonBody: { mobile: '13800000000' },
    }),
    [
      {
        errcode: 88,
        sub_code: '40014',
        sub_msg: '不合法的access_token',
      },
      { errcode: 0, result: { userid: 'user-1' } },
    ],
  );

  const result = await apiRequest.run.call(context, 0);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.url, 'https://oapi.dingtalk.com/topapi/v2/user/getbymobile');
  assert.equal(calls[0].authentication.credentialsDecrypted.data.accessToken, 'stale-token');
  assert.equal(calls[1].authentication.credentialsDecrypted.data.accessToken, '');
  assert.deepEqual(result.json, { errcode: 0, result: { userid: 'user-1' } });
});

test('accepts official full URLs and wraps array responses', async () => {
  const { calls, context } = createContext(
    baseParameters({
      url: 'https://api.dingtalk.com/v1.0/contact/users?language=zh_CN',
    }),
    [[{ userid: 'user-1' }]],
  );

  const result = await apiRequest.run.call(context, 0);

  assert.equal(
    calls[0].options.url,
    'https://api.dingtalk.com/v1.0/contact/users?language=zh_CN',
  );
  assert.deepEqual(result, {
    json: { data: [{ userid: 'user-1' }] },
    pairedItem: { item: 0 },
  });
});

test('accepts complete URLs for both DingTalk API hosts', () => {
  assert.equal(
    resolveDingTalkUrl(' https://api.dingtalk.com/v1.0/contact/users/me '),
    'https://api.dingtalk.com/v1.0/contact/users/me',
  );
  assert.equal(
    resolveDingTalkUrl('https://oapi.dingtalk.com/topapi/v2/user/get'),
    'https://oapi.dingtalk.com/topapi/v2/user/get',
  );
});

test('rejects incomplete or unsafe URLs before sending credentials', async () => {
  const unsafeUrls = [
    '',
    '/topapi/v2/user/get',
    'topapi/v2/user/get',
    '//evil.example/path',
    'http://api.dingtalk.com/v1.0/contact/users/me',
    'https://evil.example/v1.0/contact/users/me',
    'https://api.dingtalk.com.evil.example/v1.0/contact/users/me',
    'https://user:pass@api.dingtalk.com/v1.0/contact/users/me',
    'https://api.dingtalk.com:8443/v1.0/contact/users/me',
    'https://api.dingtalk.com/v1.0/contact/users/me#fragment',
    'https://oapi.dingtalk.com/topapi/v2/user/get?access_token=manual-token',
  ];

  for (const url of unsafeUrls) {
    assert.throws(() => resolveDingTalkUrl(url));
  }

  const { calls, context } = createContext(
    baseParameters({
      url: 'https://evil.example/api',
    }),
    [{ shouldNot: 'run' }],
  );
  await assert.rejects(apiRequest.run.call(context, 0), /api\.dingtalk\.com/);
  assert.equal(calls.length, 0);
});

test('rejects manually supplied access-token fields', async () => {
  const queryCase = createContext(
    baseParameters({
      queryParameters: {
        parameters: [{ name: 'access_token', value: 'manual-token' }],
      },
    }),
    [{ shouldNot: 'run' }],
  );
  await assert.rejects(apiRequest.run.call(queryCase.context, 0), /自动注入/);
  assert.equal(queryCase.calls.length, 0);

  const headerCase = createContext(
    baseParameters({
      headers: {
        parameters: [
          { name: 'X-ACS-DINGTALK-ACCESS-TOKEN', value: 'manual-token' },
        ],
      },
    }),
    [{ shouldNot: 'run' }],
  );
  await assert.rejects(apiRequest.run.call(headerCase.context, 0), /自动注入/);
  assert.equal(headerCase.calls.length, 0);

  for (const name of [
    'HoSt',
    'CONTENT-LENGTH',
    'Transfer-Encoding',
    'Connection',
    'Proxy-Authorization',
  ]) {
    const reservedHeaderCase = createContext(
      baseParameters({
        headers: { parameters: [{ name, value: 'unsafe-value' }] },
      }),
      [{ shouldNot: 'run' }],
    );
    await assert.rejects(apiRequest.run.call(reservedHeaderCase.context, 0), /不允许/);
    assert.equal(reservedHeaderCase.calls.length, 0);
  }
});

test('rejects unsupported HTTP methods before sending credentials', async () => {
  const { calls, context } = createContext(
    baseParameters({ method: 'TRACE' }),
    [{ shouldNot: 'run' }],
  );

  await assert.rejects(apiRequest.run.call(context, 0), /不支持请求方法 TRACE/);
  assert.equal(calls.length, 0);
});

test('rejects an invalid JSON body and handles a null response', async () => {
  const invalidBody = createContext(
    baseParameters({
      method: 'POST',
      sendBody: true,
      jsonBody: '{invalid-json',
    }),
    [{ shouldNot: 'run' }],
  );
  await assert.rejects(apiRequest.run.call(invalidBody.context, 0), /请求体 JSON/);
  assert.equal(invalidBody.calls.length, 0);

  const nullResponse = createContext(baseParameters(), [null]);
  const result = await apiRequest.run.call(nullResponse.context, 0);
  assert.deepEqual(result.json, { data: null });
});
