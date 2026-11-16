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

function clock(t, random = 0) {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(Math, 'random', () => random);
  return { advance: (milliseconds) => (now += milliseconds) };
}

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
  const requests = [];
  const crons = [];
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
      this.index = sockets.length;
      const autoOpen =
        typeof options.autoOpen === 'function'
          ? options.autoOpen(this.index)
          : options.autoOpen !== false;
      if (autoOpen) queueMicrotask(() => this.open());
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
      options.onOpen?.(this);
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
      if (options.closeStalls) {
        this.readyState = FakeWebSocket.CLOSING;
        return;
      }
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
      registerCron(cron, callback) {
        crons.push({ expression: cron.expression, callback });
      },
      async httpRequest(request) {
        requests.push(request);
        if (options.httpRequest) return await options.httpRequest(request, requests.length);
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
    requests,
    crons,
    context,
    tick(expression = '* * * * * *') {
      const cron = crons.find((entry) => entry.expression === expression);
      assert.ok(cron, `registered cron ${expression}`);
      cron.callback(new Date());
    },
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
  const time = clock(t);
  const f = await fixture(t, { responseMode: 'responseNode' });
  f.sockets[0].receive(event());
  f.sockets[0].close();
  await flush();
  assert.equal(f.sockets.length, 1);
  time.advance(1000);
  f.tick();
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
  const closingAgain = f.response.closeFunction();
  assert.strictEqual(closing, closingAgain);
  assert.equal(f.sockets[0].closeCalls, 0);
  // Manual trigger output resolves once; later arrivals must not share that execution's reply.
  f.sockets[0].receive(event('event-2', 'delivery-2'));
  assert.equal(f.emissions.length, 1);
  await executeResponse(responseContext(f));
  await closing;
  await closingAgain;
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

test('gateway timeout releases the attempt and ignores a late ticket', async (t) => {
  const gateway = deferred();
  const deadline = new AbortController();
  let request;
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 10_000);
    return deadline.signal;
  });
  const starting = fixture(t, {
    httpRequest: (options) => {
      request = options;
      return gateway.promise;
    },
  });
  await flush();
  assert.equal(request.timeout, 10_000);
  assert.equal(request.abortSignal.aborted, false);
  deadline.abort(new Error('connection deadline exceeded'));
  const f = await starting;
  assert.equal(request.abortSignal.aborted, true);
  assert.equal(f.sockets.length, 0);
  assert.equal(f.logs.filter((entry) => entry.level === 'warn').length, 2);
  gateway.resolve({ endpoint: 'wss://stream.test/connect', ticket: 'late-ticket' });
  await flush();
  assert.equal(f.sockets.length, 0);
});

test('the connection deadline also bounds the handshake and removes its listeners', async (t) => {
  const deadline = new AbortController();
  let deadlines = 0;
  t.mock.method(AbortSignal, 'timeout', (milliseconds) => {
    assert.equal(milliseconds, 10_000);
    deadlines++;
    return deadline.signal;
  });
  const starting = fixture(t, { autoOpen: false });
  await flush();
  deadline.abort(new Error('handshake deadline exceeded'));
  const f = await starting;
  const abandoned = f.sockets[0];
  assert.equal(deadlines, 1, 'ticket and handshake share one deadline');
  assert.equal(abandoned.closeCalls, 1);
  assert.equal(
    [...abandoned.listeners.values()].every((listeners) => listeners.size === 0),
    true,
  );
  abandoned.readyState = WebSocket.OPEN;
  abandoned.dispatch('open', {});
  abandoned.receive(event());
  assert.equal(f.emissions.length, 0);
  assert.equal(abandoned.sent.length, 0);
});

test('failed connections back off, stay bounded, and reset after a successful connection', async (t) => {
  const time = clock(t);
  const f = await fixture(t, {
    httpRequest: (_request, attempt) => {
      if (attempt <= 8) throw new Error('gateway unavailable');
      return { endpoint: 'wss://stream.test/connect', ticket: `ticket-${attempt}` };
    },
  });
  for (const delay of [1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000]) {
    const before = f.requests.length;
    time.advance(delay - 1);
    f.tick();
    await flush();
    assert.equal(f.requests.length, before, 'no retry before its deadline');
    time.advance(1);
    f.tick();
    f.tick();
    await flush();
    assert.equal(f.requests.length, before + 1, 'one retry per deadline');
  }
  assert.equal(f.sockets.length, 1);
  assert.equal(new Set(f.requests.map((request) => request.abortSignal)).size, f.requests.length);
  f.sockets[0].close();
  time.advance(999);
  f.tick();
  await flush();
  assert.equal(f.requests.length, 9);
  time.advance(1);
  f.tick();
  await flush();
  assert.equal(f.requests.length, 10, 'successful connection resets backoff');
  assert.match(f.sockets[1].url, /ticket=ticket-10$/);
});

test('reconnect jitter delays the next attempt instead of retrying immediately', async (t) => {
  const time = clock(t, 0.5);
  const f = await fixture(t);
  f.sockets[0].close();
  time.advance(1499);
  f.tick();
  await flush();
  assert.equal(f.requests.length, 1);
  time.advance(1);
  f.tick();
  await flush();
  assert.equal(f.requests.length, 2);
});

test('socket errors recover even when close stalls and stale callbacks cannot affect the replacement', async (t) => {
  const time = clock(t);
  const f = await fixture(t, { closeStalls: true });
  const abandoned = f.sockets[0];
  const lateMessage = [...abandoned.listeners.get('message')][0];
  const lateError = [...abandoned.listeners.get('error')][0];
  abandoned.dispatch('error', { error: new Error('connection failed') });
  abandoned.dispatch('close', {});
  assert.equal(abandoned.readyState, WebSocket.CLOSING);
  assert.equal(abandoned.closeCalls, 1);
  assert.equal(
    [...abandoned.listeners.values()].every((listeners) => listeners.size === 0),
    true,
  );
  time.advance(1000);
  f.tick();
  await flush();
  assert.equal(f.sockets.length, 2);
  lateMessage({ data: JSON.stringify(event()) });
  lateError({ error: new Error('late socket error') });
  abandoned.dispatch('close', {});
  assert.equal(f.emissions.length, 0);
  f.sockets[1].receive(event('replacement-event', 'replacement-delivery'));
  assert.equal(f.emissions.length, 1);
  assert.equal(f.sockets[1].acknowledgements().length, 1);
  assert.equal(f.requests.length, 2);
});

test('stopping during a ticket request cancels it and never opens a late connection', async (t) => {
  const time = clock(t);
  const gateway = deferred();
  const f = await fixture(t, {
    httpRequest: (_request, attempt) =>
      attempt === 1
        ? { endpoint: 'wss://stream.test/connect', ticket: 'first-ticket' }
        : gateway.promise,
  });
  f.sockets[0].close();
  time.advance(1000);
  f.tick();
  await flush();
  f.tick();
  f.tick();
  assert.equal(f.requests.length, 2);
  await f.response.closeFunction();
  assert.equal(f.requests[1].abortSignal.aborted, true);
  gateway.resolve({ endpoint: 'wss://stream.test/connect', ticket: 'late-ticket' });
  await flush();
  time.advance(600_000);
  f.tick();
  f.tick('*/30 * * * * *');
  await flush();
  assert.equal(f.requests.length, 2);
  assert.equal(f.sockets.length, 1);
});

test('stopping during a handshake closes it and prevents late messages or retries', async (t) => {
  const time = clock(t);
  const f = await fixture(t, { autoOpen: (index) => index === 1 });
  const oldMessage = [...f.sockets[0].listeners.get('message')][0];
  f.sockets[0].close();
  time.advance(1000);
  f.tick();
  await flush();
  const pending = f.sockets[1];
  assert.equal(pending.readyState, WebSocket.CONNECTING);
  await f.response.closeFunction();
  assert.equal(pending.closeCalls, 1);
  assert.equal(
    [...pending.listeners.values()].every((listeners) => listeners.size === 0),
    true,
  );
  pending.readyState = WebSocket.OPEN;
  pending.dispatch('open', {});
  pending.receive(event());
  oldMessage({ data: JSON.stringify(event()) });
  time.advance(600_000);
  f.tick();
  await flush();
  assert.equal(f.emissions.length, 0);
  assert.equal(f.requests.length, 2);
});

test('a socket closing immediately after open is never installed as a live connection', async (t) => {
  const time = clock(t);
  const f = await fixture(t, {
    onOpen: (socket) => {
      if (socket.index === 1) socket.close();
    },
  });
  f.sockets[0].receive(event());
  assert.equal(f.emissions.length, 0);
  time.advance(1000);
  f.tick();
  await flush();
  f.sockets[1].receive(event());
  assert.equal(f.emissions.length, 1);
});

test('heartbeat keeps its 30 second registration and does not act as an active probe', async (t) => {
  const f = await fixture(t);
  assert.deepEqual(f.crons.map((cron) => cron.expression).sort(), [
    '* * * * * *',
    '*/30 * * * * *',
  ]);
  f.tick();
  assert.deepEqual(f.sockets[0].sent, []);
  f.tick('*/30 * * * * *');
  assert.deepEqual(f.sockets[0].sent, ['ping']);
  await f.response.closeFunction();
  f.tick('*/30 * * * * *');
  assert.deepEqual(f.sockets[0].sent, ['ping']);
});

test('heartbeat send failure uses the same cleanup and backoff without waiting for close', async (t) => {
  const time = clock(t);
  const f = await fixture(t, { closeStalls: true });
  f.sockets[0].sendError = new Error('write failed');
  f.tick('*/30 * * * * *');
  assert.equal(f.sockets[0].closeCalls, 1);
  assert.equal(f.requests.length, 1);
  time.advance(1000);
  f.tick();
  await flush();
  assert.equal(f.sockets.length, 2);
  f.sockets[1].receive(event());
  assert.equal(f.emissions.length, 1);
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
