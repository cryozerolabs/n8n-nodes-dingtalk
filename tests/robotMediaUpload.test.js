const assert = require('node:assert/strict');
const test = require('node:test');

const mediaUpload = require('../dist/nodes/DingtalkNode/resources/robot/mediaUpload').default;
const {
  buildMultipartBody,
} = require('../dist/nodes/DingtalkNode/resources/robot/mediaUpload');

function createContext(params, response) {
  const calls = [];
  const buffer = Buffer.from('fake-file-content');

  return {
    calls,
    buffer,
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

test('buildMultipartBody assembles type and media parts with boundary', () => {
  const file = Buffer.from('hello file');
  const body = buildMultipartBody({
    boundary: '----boundary123',
    mediaType: 'video',
    fileName: 'video.mp4',
    mimeType: 'video/mp4',
    file,
  });

  const text = body.toString('utf8');
  assert.ok(text.startsWith('------boundary123\r\n'));
  assert.ok(text.includes('Content-Disposition: form-data; name="type"\r\n\r\nvideo\r\n'));
  assert.ok(
    text.includes(
      'Content-Disposition: form-data; name="media"; filename="video.mp4"\r\nContent-Type: video/mp4\r\n\r\n',
    ),
  );
  assert.ok(text.endsWith('\r\n------boundary123--\r\n'));
  // 文件字节必须原样保留在报文中
  assert.ok(body.includes(file));
});

test('buildMultipartBody sanitizes unsafe characters in file name', () => {
  const body = buildMultipartBody({
    boundary: '----b',
    mediaType: 'file',
    fileName: 'my"file\\odd\r\nname.xlsx',
    mimeType: 'application/octet-stream',
    file: Buffer.from('x'),
  });

  const text = body.toString('utf8');
  assert.ok(!text.includes('odd\r\nname'));
  assert.ok(text.includes('filename="my_file_odd__name.xlsx"'));
});

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

test('robot.media.upload posts handcrafted multipart to oapi media/upload', async () => {
  const { calls, buffer, context } = createContext(
    { mediaType: 'file' },
    { errcode: 0, errmsg: 'ok', type: 'file', media_id: '@lAzPabc', created_at: 1780000000000 },
  );

  const result = await mediaUpload.run.call(context, 0);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].credentialType, 'dingtalkApi');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.url, 'https://oapi.dingtalk.com/media/upload');
  assert.equal(calls[0].options.json, false);

  const contentType = calls[0].options.headers['Content-Type'];
  assert.match(contentType, /^multipart\/form-data; boundary=----n8nDingtalkMedia/);
  const boundary = contentType.split('boundary=')[1];

  const body = calls[0].options.body;
  assert.ok(Buffer.isBuffer(body));
  assert.ok(body.includes(buffer));
  const text = body.toString('utf8');
  assert.ok(text.includes('name="type"\r\n\r\nfile\r\n'));
  assert.ok(text.includes('filename="报表.xlsx"'));
  assert.ok(
    text.includes(
      'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ),
  );
  assert.ok(text.includes(`--${boundary}--`));

  assert.deepEqual(result.json, {
    errcode: 0,
    errmsg: 'ok',
    type: 'file',
    media_id: '@lAzPabc',
    created_at: 1780000000000,
  });
  assert.deepEqual(result.pairedItem, { item: 0 });
});

test('robot.media.upload prefers the fileName override', async () => {
  const { calls, context } = createContext(
    { mediaType: 'file', fileName: 'report.xlsx' },
    { errcode: 0, errmsg: 'ok', type: 'file', media_id: '@lAzPabc', created_at: 1 },
  );

  await mediaUpload.run.call(context, 0);

  const text = calls[0].options.body.toString('utf8');
  assert.ok(text.includes('filename="report.xlsx"'));
});

test('robot.media.upload parses string responses and rejects non-zero errcode', async () => {
  const { calls, context } = createContext(
    { mediaType: 'image' },
    JSON.stringify({ errcode: 43008, errmsg: '参数需要multipart类型' }),
  );

  await assert.rejects(
    () => mediaUpload.run.call(context, 0),
    /参数需要multipart类型/,
  );
  assert.equal(calls.length, 1);
});
