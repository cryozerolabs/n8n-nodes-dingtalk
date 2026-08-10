const assert = require('node:assert/strict');
const test = require('node:test');

const uploadAttachment = require(
  '../dist/nodes/DingtalkNode/resources/doc/resourceUploadAttachment',
).default;

test('uploads to the signed storage URL without attaching DingTalk credentials', async () => {
  const authenticatedCalls = [];
  const directCalls = [];
  const uploadBuffer = Buffer.from('file-content');
  const parameters = {
    overrideOperator: false,
    docId: 'doc-1',
    inputDataFieldName: 'data',
  };
  const context = {
    getNodeParameter(name, _itemIndex, defaultValue) {
      return Object.hasOwn(parameters, name) ? parameters[name] : defaultValue;
    },
    async getCredentials() {
      return {
        accessToken: 'secret-token',
        userUnionId: 'operator-1',
      };
    },
    getNode() {
      return {
        id: 'test-node',
        name: 'DingTalk Document Upload',
        type: 'CUSTOM.dingtalkNode',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      };
    },
    helpers: {
      assertBinaryData() {
        return { fileName: 'example.txt', mimeType: 'text/plain' };
      },
      async getBinaryDataBuffer() {
        return uploadBuffer;
      },
      async httpRequestWithAuthentication(credentialType, options) {
        authenticatedCalls.push({ credentialType, options });
        return {
          result: {
            resourceId: 'resource-1',
            resourceUrl: 'https://docs.dingtalk.com/resource-1',
            uploadUrl: 'https://storage.example.com/signed-upload',
          },
        };
      },
      async httpRequest(options) {
        directCalls.push(options);
        return {};
      },
    },
    logger: {
      debug() {},
      error() {},
    },
  };

  const result = await uploadAttachment.run.call(context, 0);

  assert.equal(authenticatedCalls.length, 1);
  assert.equal(authenticatedCalls[0].credentialType, 'dingtalkApi');
  assert.equal(directCalls.length, 1);
  assert.equal(directCalls[0].url, 'https://storage.example.com/signed-upload');
  assert.equal(directCalls[0].headers['Content-Type'], 'text/plain');
  assert.equal(directCalls[0].body, uploadBuffer);
  assert.equal(directCalls[0].disableFollowRedirect, undefined);
  assert.equal(directCalls[0].sendCredentialsOnCrossOriginRedirect, undefined);
  assert.deepEqual(result, {
    json: {
      filename: 'example.txt',
      size: uploadBuffer.length,
      type: 'text/plain',
      resourceId: 'resource-1',
      url: 'https://docs.dingtalk.com/resource-1',
    },
    pairedItem: { item: 0 },
  });
});
