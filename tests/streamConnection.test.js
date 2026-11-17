const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const test = require('node:test');
const { runStreamPushTrigger } = require('../dist/nodes/DingtalkNode/triggers/streamPushTrigger');

test(
  'native WebSocket timeout and shutdown do not wait for an unresponsive peer to close',
  {
    timeout: 20_000,
  },
  async (t) => {
    const NativeWebSocket = globalThis.WebSocket;
    const sockets = [];
    const transports = new Set();
    const crons = [];
    let requests = 0;
    let response;
    let resolveUpgrade;
    const upgraded = new Promise((resolve) => {
      resolveUpgrade = resolve;
    });
    const server = createServer();
    server.on('connection', (transport) => {
      transports.add(transport);
      transport.once('close', () => transports.delete(transport));
    });
    server.on('upgrade', () => {
      resolveUpgrade();
      // Accept TCP and deliberately never complete the WebSocket handshake.
    });
    t.after(async () => {
      await response?.closeFunction();
      for (const transport of transports) transport.destroy();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      globalThis.WebSocket = NativeWebSocket;
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    globalThis.WebSocket = class extends NativeWebSocket {
      constructor(url) {
        super(url);
        sockets.push(this);
      }
    };
    const context = {
      getCredentials: async () => ({ clientId: 'local-test', clientSecret: 'local-test' }),
      getNodeParameter: (_name, fallback) => fallback,
      getMode: () => 'trigger',
      emit: () => assert.fail('an incomplete handshake must not emit workflow data'),
      helpers: {
        async httpRequest(options) {
          requests++;
          assert.equal(options.timeout, 10_000);
          return { endpoint: `ws://127.0.0.1:${server.address().port}`, ticket: 'local-ticket' };
        },
        registerCron: (cron, callback) => crons.push({ expression: cron.expression, callback }),
      },
      logger: { debug() {}, warn() {}, error() {} },
    };
    const startedAt = performance.now();
    const starting = runStreamPushTrigger.call(context);
    await upgraded;
    assert.equal(sockets[0].readyState, NativeWebSocket.CONNECTING);
    response = await starting;
    assert.ok(performance.now() - startedAt >= 9000, 'the real connection deadline elapsed');
    assert.ok(
      [NativeWebSocket.CLOSING, NativeWebSocket.CLOSED].includes(sockets[0].readyState),
      'the abandoned handshake was asked to close',
    );
    await response.closeFunction();
    for (const cron of crons) cron.callback(new Date());
    await new Promise(setImmediate);
    assert.equal(requests, 1);
    assert.equal(sockets.length, 1);
    // Native close() need not emit close promptly for an abandoned handshake.
    // Shutdown and retry cancellation must not depend on that event.
  },
);
