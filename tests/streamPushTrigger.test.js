const assert = require('node:assert/strict');
const test = require('node:test');

const {
  runStreamPushTrigger,
  streamPushTriggerOptions,
} = require('../dist/nodes/DingtalkNode/triggers/streamPushTrigger');
const { DingtalkNode } = require('../dist/nodes/DingtalkNode/DingtalkNode.node');
const streamBundle = require('../dist/nodes/DingtalkNode/resources/stream').default;
const { STREAM_RESPONSE_TYPE } = require('../dist/nodes/DingtalkNode/resources/stream/common');

function deferred() {
  const result = {};
  result.promise = new Promise((resolve, reject) => Object.assign(result, { resolve, reject }));
  return result;
}

const flush = () => new Promise(setImmediate);
const successfulRun = () => ({ status: 'success', finished: true, data: { resultData: {} } });

function event(eventId = 'department-event-1', messageId = 'delivery-1', extraHeaders = {}) {
  return {
    specVersion: '1.0',
    type: 'EVENT',
    headers: {
      topic: '*',
      messageId,
      eventId,
      eventCorpId: 'corp-1',
      eventUnifiedAppId: 'app-1',
      eventType: 'org_dept_create',
      ...extraHeaders,
    },
    data: JSON.stringify({ EventType: 'org_dept_create', DeptId: [123] }),
  };
}

async function fixture(t, options = {}) {
  const originalWebSocket = globalThis.WebSocket;
  const sockets = [];
  const emissions = [];
  const logs = [];
  let response;

  class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = FakeWebSocket.CONNECTING;
    listeners = new Map();
    sent = [];
    closeCalls = 0;

    constructor(url) {
      this.url = url;
      sockets.push(this);
      queueMicrotask(() => this.open());
    }
    addEventListener(name, listener) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(listener);
    }
    removeEventListener(name, listener) {
      this.listeners.get(name)?.delete(listener);
    }
    dispatch(name, payload) {
      for (const listener of [...(this.listeners.get(name) ?? [])]) listener(payload);
    }
    open() {
      if (this.readyState !== FakeWebSocket.CONNECTING) return;
      this.readyState = FakeWebSocket.OPEN;
      this.dispatch('open', {});
    }
    receive(payload) {
      this.dispatch('message', {
        data: typeof payload === 'string' ? payload : JSON.stringify(payload),
      });
    }
    send(payload) {
      if (this.sendError) throw this.sendError;
      assert.equal(this.readyState, FakeWebSocket.OPEN);
      this.sent.push(payload);
    }
    close() {
      this.closeCalls++;
      this.readyState = FakeWebSocket.CLOSED;
      this.dispatch('close', { code: 1000, reason: '', wasClean: true });
    }
    acknowledgements() {
      return this.sent.filter((s) => s.startsWith('{')).map((s) => JSON.parse(s));
    }
  }
  globalThis.WebSocket = FakeWebSocket;
  const context = {
    getMode: () => options.mode ?? 'trigger',
    getNodeParameter(name, fallback) {
      return options[name] ?? fallback;
    },
    getNode: () => ({
      id: 'trigger-1',
      name: 'DingTalk',
      type: 'test',
      typeVersion: 1,
      parameters: {},
      position: [0, 0],
    }),
    getCredentials: async () => ({ clientId: 'test-client', clientSecret: 'test-secret' }),
    emit(data, responsePromise, donePromise) {
      emissions.push({ data, responsePromise, donePromise });
      if (options.emitError) throw options.emitError;
    },
    helpers: {
      createDeferredPromise: deferred,
      returnJsonArray: (items) => items.map((json) => ({ json })),
      registerCron() {},
      async httpRequest() {
        return { endpoint: 'wss://stream.test/connect', ticket: 'test-ticket' };
      },
    },
    logger: Object.fromEntries(
      ['debug', 'warn', 'error', 'info'].map((level) => [
        level,
        (...args) => logs.push({ level, args }),
      ]),
    ),
  };
  const starting = runStreamPushTrigger.call(context).then((r) => {
    response = r;
    return r;
  });
  t.after(async () => {
    if (response) await response.closeFunction();
    globalThis.WebSocket = originalWebSocket;
  });
  await starting;
  return {
    sockets,
    emissions,
    logs,
    context,
    get response() {
      return response;
    },
  };
}

function reply(status = 'SUCCESS', message = '') {
  return { type: STREAM_RESPONSE_TYPE, status, message };
}

async function executeResponse(context) {
  return await new DingtalkNode().execute.call({
    continueOnFail: () => false,
    prepareOutputData: (items) => [items],
    ...context,
    getNodeParameter(name, itemIndex, fallback) {
      if (name === 'operation') return 'stream.respond';
      return context.getNodeParameter?.(name, itemIndex, fallback) ?? fallback;
    },
  });
}

function responseContext(
  f,
  emission = 0,
  status = 'SUCCESS',
  items = [{ json: { result: 'ok' } }],
) {
  return {
    getInputData: () => items,
    getNode: f.context.getNode,
    getNodeParameter(name, _index, fallback) {
      if (name === 'status') return status;
      if (name === 'message') return 'response from node';
      return fallback;
    },
    sendResponse(value) {
      f.emissions[emission].responsePromise.resolve(value);
    },
  };
}

function acks(f) {
  return f.sockets[0].acknowledgements().map((a) => ({
    messageId: a.headers.messageId,
    code: a.code,
    status: JSON.parse(a.data).status,
    message: JSON.parse(a.data).message,
  }));
}

test('response-mode default is empty for existing workflows', () => {
  const mode = streamPushTriggerOptions.find((p) => p.name === 'responseMode');
  assert.equal(mode.default, '');
  assert.deepEqual(
    mode.options.map((o) => o.value),
    ['', 'responseNode'],
  );
});

for (const [label, mode] of [
  ['missing setting', undefined],
  ['empty setting', ''],
]) {
  test(`${label} preserves immediate SUCCESS and the original output`, async (t) => {
    const f = await fixture(t, { responseMode: mode });
    f.sockets[0].receive(event());
    assert.equal(f.emissions.length, 1);
    assert.equal(f.emissions[0].responsePromise, undefined);
    assert.equal(f.emissions[0].donePromise, undefined);
    assert.deepEqual(acks(f), [
      { messageId: 'delivery-1', code: 200, status: 'SUCCESS', message: undefined },
    ]);
    const item = f.emissions[0].data[0][0].json;
    assert.deepEqual(item.data.DeptId, [123]);
    assert.equal(item.rawData, event().data);
  });
}

test('response-node mode does not ACK merely because the event was emitted', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  await flush();
  assert.equal(f.emissions.length, 1);
  assert.ok(f.emissions[0].responsePromise);
  assert.ok(f.emissions[0].donePromise);
  assert.deepEqual(acks(f), []);
});

test('dedicated response node ACKs before the remaining workflow completes', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  await executeResponse(responseContext(f));
  await flush();
  assert.deepEqual(acks(f), [
    { messageId: 'delivery-1', code: 200, status: 'SUCCESS', message: 'response from node' },
  ]);
  f.emissions[0].donePromise.reject(new Error('later business node failed'));
  await flush();
  assert.equal(acks(f).length, 1);
});

test('dedicated response node can explicitly request LATER', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  await executeResponse(responseContext(f, 0, 'LATER'));
  await flush();
  assert.equal(acks(f)[0].code, 200);
  assert.equal(acks(f)[0].status, 'LATER');
});

test('successful workflow without a response node still replies LATER', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  f.emissions[0].donePromise.resolve(successfulRun());
  await flush();
  assert.equal(acks(f)[0].status, 'LATER');
});

test('n8n empty response cleanup is never mistaken for SUCCESS', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  f.emissions[0].responsePromise.resolve({});
  f.emissions[0].donePromise.resolve(successfulRun());
  await flush();
  assert.equal(acks(f).length, 1);
  assert.equal(acks(f)[0].status, 'LATER');
});

for (const status of ['error', 'canceled', 'waiting']) {
  test(`${status} before the response node requests redelivery`, async (t) => {
    const f = await fixture(t, { responseMode: 'responseNode' });
    f.sockets[0].receive(event());
    f.emissions[0].donePromise.resolve({ status });
    await flush();
    assert.equal(acks(f)[0].status, 'LATER');
  });
}

test('execution dispatch rejection requests redelivery', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  f.emissions[0].donePromise.reject(new Error('could not start workflow'));
  await flush();
  assert.equal(acks(f)[0].status, 'LATER');
});

test('synchronous emit failure requests redelivery', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode', emitError: new Error('emit failed') });
  f.sockets[0].receive(event());
  await flush();
  assert.equal(acks(f)[0].status, 'LATER');
});

test('a response-channel rejection requests redelivery', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  f.emissions[0].responsePromise.reject(new Error('response failed'));
  await flush();
  assert.equal(acks(f)[0].status, 'LATER');
});

test('timeout replies LATER once and a late SUCCESS cannot reverse it', async (t) => {
  const deadline = new AbortController();
  let timeoutMs;
  t.mock.method(AbortSignal, 'timeout', (ms) => {
    timeoutMs = ms;
    return deadline.signal;
  });
  const f = await fixture(t, { responseMode: 'responseNode', responseTimeout: 12 });
  f.sockets[0].receive(event());
  assert.equal(timeoutMs, 12_000);
  deadline.abort();
  await flush();
  assert.equal(acks(f)[0].status, 'LATER');
  f.emissions[0].responsePromise.resolve(reply());
  f.emissions[0].donePromise.resolve(successfulRun());
  await flush();
  assert.equal(acks(f).length, 1);
});

test('an unrelated HTTP response cannot confirm a Stream event', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  f.emissions[0].responsePromise.resolve({ statusCode: 200, body: { status: 'SUCCESS' } });
  await flush();
  assert.equal(acks(f)[0].status, 'LATER');
});

test('two simultaneous executions respond to their own delivery IDs', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event('event-1', 'delivery-1'));
  f.sockets[0].receive(event('event-2', 'delivery-2'));
  f.emissions[1].responsePromise.resolve(reply('LATER'));
  f.emissions[0].responsePromise.resolve(reply('SUCCESS'));
  await flush();
  assert.deepEqual(
    acks(f).map((a) => [a.messageId, a.status]),
    [
      ['delivery-2', 'LATER'],
      ['delivery-1', 'SUCCESS'],
    ],
  );
});

test('only the first explicit response is sent', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  f.emissions[0].responsePromise.resolve(reply('SUCCESS'));
  f.emissions[0].responsePromise.resolve(reply('LATER'));
  await flush();
  assert.equal(acks(f).length, 1);
  assert.equal(acks(f)[0].status, 'SUCCESS');
});

test('a delayed ACK is not sent over a replacement connection', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  f.sockets[0].close();
  await flush();
  assert.equal(f.sockets.length, 2);
  f.emissions[0].responsePromise.resolve(reply());
  await flush();
  assert.equal(f.sockets[1].acknowledgements().length, 0);
});

test('shutdown stops waiting and never sends SUCCESS afterwards', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  await f.response.closeFunction();
  f.emissions[0].responsePromise.resolve(reply());
  await flush();
  assert.deepEqual(acks(f), []);
});

test('CALLBACK retains immediate ACK even when EVENT uses a response node', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive({ ...event(), type: 'CALLBACK' });
  assert.equal(acks(f)[0].status, 'SUCCESS');
  assert.equal(f.emissions[0].responsePromise, undefined);
});

test('response timeout is validated only when response-node mode is selected', async (t) => {
  await assert.rejects(fixture(t, { responseMode: 'responseNode', responseTimeout: 0 }), /1.*3600/);
});

test('legacy immediate mode ignores a leftover response-timeout parameter', async (t) => {
  const f = await fixture(t, { responseMode: '', responseTimeout: 0 });
  f.sockets[0].receive(event());
  assert.equal(acks(f)[0].status, 'SUCCESS');
});

test('the response node passes input items and binary data through unchanged', async () => {
  const items = [
    { json: { id: 1 }, binary: { data: { data: 'YWJj', mimeType: 'text/plain' } } },
    { json: { id: 2 } },
  ];
  const sent = [];
  const result = await executeResponse({
    getInputData: () => items,
    getNodeParameter: (name) => (name === 'status' ? 'SUCCESS' : ''),
    sendResponse(value) {
      sent.push(value);
    },
  });
  assert.deepEqual(
    result[0].map((item) => item.json),
    items.map((item) => item.json),
  );
  assert.strictEqual(result[0][0].binary, items[0].binary);
  assert.deepEqual(
    result[0].map((item) => item.pairedItem),
    [{ item: 0 }, { item: 1 }],
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, STREAM_RESPONSE_TYPE);
});

test('the response node rejects an invalid status before emitting a signal', async () => {
  await assert.rejects(
    executeResponse({
      getInputData: () => [{ json: {} }],
      getNodeParameter: () => 'INVALID',
      getNode: () => ({
        id: 'response',
        name: 'Response',
        type: 'test',
        typeVersion: 1,
        parameters: {},
        position: [0, 0],
      }),
      continueOnFail: () => false,
      sendResponse() {
        assert.fail('must not send an invalid response');
      },
    }),
    /SUCCESS.*LATER/,
  );
});

test('manual execution keeps the connection until its response node replies', async (t) => {
  const f = await fixture(t, { mode: 'manual', responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  const closing = f.response.closeFunction();
  assert.equal(f.sockets[0].closeCalls, 0);
  // Manual trigger output resolves once; later arrivals must not share that execution's reply.
  f.sockets[0].receive(event('event-2', 'delivery-2'));
  assert.equal(f.emissions.length, 1);
  await executeResponse(responseContext(f));
  await closing;
  assert.equal(acks(f)[0].status, 'SUCCESS');
  assert.equal(f.sockets[0].closeCalls, 1);
});

test('response send failure is logged without changing connection handling', async (t) => {
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  f.sockets[0].sendError = new Error('send failed');
  f.emissions[0].responsePromise.resolve(reply());
  await flush();
  assert.equal(f.logs.filter((entry) => entry.level === 'error').length, 1);
  assert.equal(f.sockets.length, 1);
});

test('an empty input does not send a response', async () => {
  const result = await executeResponse({
    getInputData: () => [],
    sendResponse() {
      assert.fail('must not respond without an input item');
    },
  });
  assert.deepEqual(result, [[]]);
});

test('response operation follows resource registration and is placed before later business steps', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.n8n.nodes.length, 2);
  assert.equal(streamBundle.value, 'stream');
  assert.ok(streamBundle.operations.some((op) => op.value === 'stream.respond'));
  const credential = new DingtalkNode().description.credentials.find(
    (c) => c.name === 'dingtalkApi',
  );
  assert.ok(credential.displayOptions.hide.operation.includes('stream.respond'));
  const example = require('../examples/基础_Stream事件响应.json');
  const trigger = example.nodes.find((node) => node.type.endsWith('.dingtalkNodeTrigger'));
  const response = example.nodes.find((node) => node.parameters.operation === 'stream.respond');
  assert.equal(trigger.parameters.responseMode, 'responseNode');
  assert.equal(response.parameters.status, 'SUCCESS');
  assert.equal(example.connections[response.name].main[0][0].node, '后续业务');
});
