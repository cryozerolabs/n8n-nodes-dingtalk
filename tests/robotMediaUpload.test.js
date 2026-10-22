const assert = require('node:assert/strict');
const test = require('node:test');

const mediaUpload = require('../dist/nodes/DingtalkNode/resources/robot/mediaUpload').default;

function createContext(params, response) {
  const calls = [];
  const buffer = Buffer.from('fake-file-content');

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
        assertBinaryData(_itemIndex, _propertyName) {
          return {
            fileName: '报表.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          };
        },
        async getBinaryDataBuffer(_itemIndex, _propertyName) {
          return buffer;
        },
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

test('robot.media.upload operation is registered with expected properties', () => {
  assert.equal(mediaUpload.value, 'robot.media.upload');
  assert.equal(mediaUpload.name, '上传媒体文件');

  const mediaType = mediaUpload.properties.find((item) => item.name === 'mediaType');
  assert.ok(mediaType, 'Expected robot.media.upload to expose mediaType');
  assert.deepEqual(
    mediaType.options.map((option) => option.value),
    ['image', 'voice', 'video', 'file'],
  );

  const binaryField = mediaUpload.properties.find((item) => item.name === 'inputDataFieldName');
  assert.equal(binaryField.required, true);
  assert.equal(binaryField.default, 'data');

  const fileName = mediaUpload.properties.find((item) => item.name === 'fileName');
  assert.equal(fileName.required, undefined);
});

test('robot.media.upload posts multipart form to oapi media/upload', async () => {
  const { calls, context } = createContext(
    { mediaType: 'file' },
    { errcode: 0, errmsg: 'ok', type: 'file', media_id: '@lAzPabc', created_at: 1780000000000 },
  );

  const result = await mediaUpload.run.call(context, 0);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentialType, 'dingtalkApi');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.url, 'https://oapi.dingtalk.com/media/upload');
  assert.equal(calls[0].options.json, false);
  // multipart 请求不应手动注入 JSON Content-Type
  assert.ok(!calls[0].options.headers || !calls[0].options.headers['Content-Type']);

  const form = calls[0].options.formData;
  assert.equal(form.type, 'file');
  assert.equal(form.media.value.equals(Buffer.from('fake-file-content')), true);
  assert.equal(form.media.options.filename, '报表.xlsx');
  assert.equal(
    form.media.options.contentType,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  assert.deepEqual(result.json, {
    errcode: 0,
    errmsg: 'ok',
    type: 'file',
    media_id: '@lAzPabc',
    created_at: 1780000000000,
  });
  assert.deepEqual(result.pairedItem, { item: 0 });
});

test('robot.media.upload prefers the fileName override for the multipart filename', async () => {
  const { calls, context } = createContext(
    { mediaType: 'file', fileName: 'report.xlsx' },
    { errcode: 0, errmsg: 'ok', type: 'file', media_id: '@lAzPabc', created_at: 1 },
  );

  await mediaUpload.run.call(context, 0);

  const mediaPart = calls[0].options.formData.media;
  assert.equal(mediaPart.options.filename, 'report.xlsx');
});

test('robot.media.upload parses string responses and rejects non-zero errcode', async () => {
  const { calls, context } = createContext(
    { mediaType: 'image' },
    JSON.stringify({ errcode: 40035, errmsg: '缺少参数 media' }),
  );

  await assert.rejects(
    () => mediaUpload.run.call(context, 0),
    /缺少参数 media/,
  );
  assert.equal(calls.length, 1);
});
