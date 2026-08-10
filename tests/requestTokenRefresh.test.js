const assert = require('node:assert/strict');
const test = require('node:test');

const { request } = require('../dist/nodes/shared/request');

const USER_GET_OPTIONS = {
  method: 'POST',
  url: 'https://oapi.dingtalk.com/topapi/v2/user/get',
  body: { userid: 'user-1' },
};

const USER_GET_BY_MOBILE_OPTIONS = {
  method: 'POST',
  url: 'https://oapi.dingtalk.com/topapi/v2/user/getbymobile',
  body: { mobile: '13800000000' },
};

function createContext(responses) {
  const calls = [];

  return {
    calls,
    context: {
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
          name: 'Test DingTalk Node',
          type: 'test.dingtalk',
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

test('refreshes the access token after legacy API error 40014', async () => {
  const { calls, context } = createContext([
    {
      errcode: 40014,
      errmsg: 'ding talk error[subcode=40014,submsg=不合法的access token]',
    },
    { errcode: 0, result: { userid: 'user-1' } },
  ]);

  const result = await request.call(context, USER_GET_OPTIONS);

  assert.deepEqual(result, { errcode: 0, result: { userid: 'user-1' } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].authentication.credentialsDecrypted.data.accessToken, 'stale-token');
  assert.equal(calls[1].authentication.credentialsDecrypted.data.accessToken, '');
});

test('uses the structured errcode when the error message omits token details', async () => {
  const { calls, context } = createContext([
    { errcode: 40014, errmsg: 'request failed' },
    { errcode: 0, result: { userid: 'user-1' } },
  ]);

  const result = await request.call(context, USER_GET_OPTIONS);

  assert.deepEqual(result, { errcode: 0, result: { userid: 'user-1' } });
  assert.equal(calls.length, 2);
});

test('uses the structured sub_code returned by legacy APIs', async () => {
  const { calls, context } = createContext([
    { errcode: 88, sub_code: '40014', sub_msg: 'request failed' },
    { errcode: 0, result: { userid: 'user-1' } },
  ]);

  const result = await request.call(context, USER_GET_OPTIONS);

  assert.deepEqual(result, { errcode: 0, result: { userid: 'user-1' } });
  assert.equal(calls.length, 2);
});

test('refreshes the token for the get-user-by-mobile operation from issue 12', async () => {
  const { calls, context } = createContext([
    {
      errcode: 40014,
      errmsg: 'ding talk error[subcode=40014,submsg=不合法的access_token]',
    },
    { errcode: 0, result: { userid: 'user-by-mobile' } },
  ]);

  const result = await request.call(context, USER_GET_BY_MOBILE_OPTIONS);

  assert.deepEqual(result, { errcode: 0, result: { userid: 'user-by-mobile' } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.url, USER_GET_BY_MOBILE_OPTIONS.url);
  assert.deepEqual(calls[0].options.body, { mobile: '13800000000' });
  assert.equal(calls[1].authentication.credentialsDecrypted.data.accessToken, '');
});

test('refreshes when an HTTP error exposes the token failure only in Error.message', async () => {
  const tokenError = new Error('access_token expired');
  tokenError.description = 'Bad request';
  const { calls, context } = createContext([tokenError, { result: { userid: 'user-1' } }]);

  const result = await request.call(context, USER_GET_OPTIONS);

  assert.deepEqual(result, { result: { userid: 'user-1' } });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].authentication.credentialsDecrypted.data.accessToken, '');
});

test('refreshes once when an API error says the app permission is not enabled', async () => {
  const permissionError = new Error('Forbidden');
  permissionError.context = {
    data: {
      errcode: 403,
      errmsg: '应用尚未开通所需的权限：[Contact.User.Read]',
    },
  };
  const { calls, context } = createContext([
    permissionError,
    { errcode: 0, result: { userid: 'user-1' } },
  ]);

  const result = await request.call(context, USER_GET_OPTIONS);

  assert.deepEqual(result, { errcode: 0, result: { userid: 'user-1' } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].authentication.credentialsDecrypted.data.accessToken, 'stale-token');
  assert.equal(calls[1].authentication.credentialsDecrypted.data.accessToken, '');
});

test('does not refresh the access token for unrelated business errors', async () => {
  const { calls, context } = createContext([{ errcode: 40035, errmsg: '缺少参数 userid' }]);

  await assert.rejects(request.call(context, USER_GET_OPTIONS));
  assert.equal(calls.length, 1);
});

test('accepts a string zero errcode as a successful response', async () => {
  const response = { errcode: '0', result: { userid: 'user-1' } };
  const { calls, context } = createContext([response]);

  const result = await request.call(context, USER_GET_OPTIONS);

  assert.deepEqual(result, response);
  assert.equal(calls.length, 1);
});

test('does not treat unrelated response fields containing 40014 as token errors', async () => {
  const response = { result: { postcode: 40014, userid: 'user-1' } };
  const { calls, context } = createContext([response]);

  const result = await request.call(context, USER_GET_OPTIONS);

  assert.deepEqual(result, response);
  assert.equal(calls.length, 1);
});

test('does not retry a successful response whose business text mentions an expired token', async () => {
  const response = {
    result: {
      message: 'The imported audit record says access token expired',
    },
  };
  const { calls, context } = createContext([response, { shouldNot: 'run' }]);

  const result = await request.call(context, USER_GET_OPTIONS);

  assert.deepEqual(result, response);
  assert.equal(calls.length, 1);
});

test('does not retry a successful response whose business text quotes a permission error', async () => {
  const response = {
    result: {
      message: '历史日志：应用尚未开通所需的权限',
    },
  };
  const { calls, context } = createContext([response, { shouldNot: 'run' }]);

  const result = await request.call(context, USER_GET_OPTIONS);

  assert.deepEqual(result, response);
  assert.equal(calls.length, 1);
});

test('retries an access token failure only once', async () => {
  const tokenError = {
    errcode: 88,
    sub_code: '40014',
    sub_msg: '不合法的access_token',
  };
  const { calls, context } = createContext([tokenError, tokenError]);

  await assert.rejects(request.call(context, USER_GET_OPTIONS), /不合法的access_token.*40014/);
  assert.equal(calls.length, 2);
});

test('does not start another refresh when the retry itself rejects', async () => {
  const { calls, context } = createContext([
    { code: 'InvalidAuthentication', message: 'access token expired' },
    new Error('access_token expired'),
    { result: { userid: 'must-not-be-returned' } },
  ]);

  await assert.rejects(request.call(context, USER_GET_OPTIONS), /access_token expired/);
  assert.equal(calls.length, 2);
});
