import {
  NodeOperationError,
  type CronExpression,
  type IDataObject,
  type INodeProperties,
  type ITriggerFunctions,
  type ITriggerResponse,
} from 'n8n-workflow';
import { waitForStreamEventResponse } from '../resources/stream/common';

// Obtain a fresh endpoint and single-use ticket for every connection attempt.
const GATEWAY_URL = 'https://api.dingtalk.com/v1.0/gateway/connections/open';
const USER_AGENT = 'n8n-nodes-dingtalk-trigger';
const CLIENT_PING_INTERVAL_SECONDS = 30;
const CRON_EXPRESSION: CronExpression = `*/${CLIENT_PING_INTERVAL_SECONDS} * * * * *`;
const RECONNECT_CRON_EXPRESSION: CronExpression = '* * * * * *';
const CONNECTION_TIMEOUT_MS = 10_000;
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 60_000;
const DEBUG_STREAM = false;

interface DingtalkCredentials {
  clientId?: string;
  clientSecret?: string;
}

type DownstreamKind = 'SYSTEM' | 'EVENT' | 'CALLBACK';

interface DownstreamHeaders {
  appId: string;
  connectionId: string;
  contentType: string;
  messageId: string;
  time: string;
  topic: string;
  eventType?: string;
  eventBornTime?: string;
  eventId?: string;
  eventCorpId?: string;
  eventUnifiedAppId?: string;
}

interface DownstreamMessage {
  specVersion: string;
  type: DownstreamKind;
  headers: DownstreamHeaders;
  data: string;
}

interface GatewayResponse {
  endpoint: string;
  ticket: string;
  expiryTime?: number;
}

function safeParse(payload: string | undefined): unknown {
  if (typeof payload !== 'string') {
    return payload ?? null;
  }

  const trimmed = payload.trim();
  if (!trimmed) {
    return payload;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return payload;
  }
}

function waitWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    signal.addEventListener('abort', onAbort, { once: true });
    void operation.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
    if (signal.aborted) {
      cleanup();
      onAbort();
    }
  });
}

export const streamPushTriggerOptions: INodeProperties[] = [
  {
    displayName: '事件响应方式',
    name: 'responseMode',
    type: 'options',
    default: '',
    options: [
      { name: '立即响应', value: '' },
      { name: '使用响应节点', value: 'responseNode' },
    ],
    description: '仅影响 EVENT 事件；使用响应节点时，由“事件订阅 → 响应事件”操作决定确认时机',
  },
  {
    displayName: '响应等待时间（秒）',
    name: 'responseTimeout',
    type: 'number',
    default: 60,
    typeOptions: { minValue: 1, maxValue: 3600 },
    displayOptions: { show: { responseMode: ['responseNode'] } },
    description: '超过等待时间仍未收到响应节点的回复时，向钉钉回复 LATER',
  },
];

export async function runStreamPushTrigger(
  this: ITriggerFunctions,
): Promise<ITriggerResponse | undefined> {
  const logDebug = (message: string, meta?: IDataObject) => {
    if (!DEBUG_STREAM) return;
    this.logger?.debug?.(message, meta);
  };

  const credentials = (await this.getCredentials('dingtalkApi')) as DingtalkCredentials;
  if (!credentials?.clientId || !credentials?.clientSecret) {
    throw new NodeOperationError(
      this.getNode(),
      'Missing DingTalk credentials. Please configure Client ID and Client Secret.',
    );
  }

  const responseMode = this.getNodeParameter('responseMode', '') as string;
  const responseTimeout =
    responseMode === 'responseNode' ? (this.getNodeParameter('responseTimeout', 60) as number) : 60;
  if (
    responseMode === 'responseNode' &&
    (!Number.isInteger(responseTimeout) || responseTimeout < 1 || responseTimeout > 3600)
  ) {
    throw new NodeOperationError(this.getNode(), '响应等待时间必须是 1 到 3600 之间的整数秒');
  }
  const responseShutdown = new AbortController();
  const pendingResponses = new Set<Promise<void>>();
  let manualResponseClosing = false;

  const subscriptions = [
    { type: 'EVENT', topic: '*' },
    { type: 'CALLBACK', topic: '/v1.0/im/bot/messages/get' },
  ] as Array<{ type: string; topic: string }>;

  let socket: WebSocket | null = null;
  let pendingSocket: WebSocket | null = null;
  let shouldStayConnected = true;
  let connectionTask: Promise<void> | null = null;
  let connectionAbort: AbortController | null = null;
  let cleanupSocketListeners: (() => void) | null = null;
  let manualResolve: (() => void) | null = null;
  let nextReconnectAt: number | null = null;
  let reconnectAttempts = 0;
  let closePromise: Promise<void> | null = null;
  let cronRegistered = false;

  const resolveManualIfPending = () => {
    if (manualResolve) {
      manualResolve();
      manualResolve = null;
    }
  };

  const sendSocketMessage = (payload: IDataObject) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
  };

  const sendRawSocketMessage = (payload: string) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(payload);
  };

  // DingTalk expects a 200/OK body with status SUCCESS to stop retrying this message.
  const sendEventAck = (headers: DownstreamHeaders, body: IDataObject) => {
    if (!headers.messageId) return;
    sendSocketMessage({
      code: 200,
      headers: {
        contentType: 'application/json',
        messageId: headers.messageId,
      },
      message: 'OK',
      data: JSON.stringify(body),
    });
  };

  const sendClientPing = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      sendRawSocketMessage('ping');
      logDebug('DingTalk stream client ping sent', { payload: 'ping' });
    } catch (error) {
      logDebug('DingTalk stream client ping send failed; closing socket', {
        error: error instanceof Error ? error.message : String(error),
      });
      disconnectSocket(socket, 'ping-send-failed');
    }
  };

  // Push the inbound payload into the workflow; the original JSON string is returned in rawData.
  const emitMessage = (
    message: DownstreamMessage,
    response?: Parameters<ITriggerFunctions['emit']>[1],
    completion?: Parameters<ITriggerFunctions['emit']>[2],
  ) => {
    const parsedData = safeParse(message.data);
    const payload: IDataObject = {
      type: message.type,
      specVersion: message.specVersion,
      headers: message.headers as unknown as IDataObject,
      data: parsedData as IDataObject | IDataObject[] | string | number | boolean | null,
      rawData: message.data,
      receivedAt: new Date().toISOString(),
    };

    this.emit([this.helpers.returnJsonArray([payload])], response, completion);
    resolveManualIfPending();
  };

  const handleSystemMessage = (message: DownstreamMessage) => {
    const topic = message.headers.topic.toUpperCase();
    if (topic === 'PING') {
      sendSocketMessage({
        code: 200,
        headers: { ...message.headers } as unknown as IDataObject,
        message: 'OK',
        data: message.data,
      });
    }
  };

  // Old workflows without a response mode retain immediate acknowledgement.
  const handleEventMessage = (message: DownstreamMessage) => {
    if (message.type === 'EVENT' && responseMode === 'responseNode') {
      if (manualResponseClosing || responseShutdown.signal.aborted) return;
      const sourceSocket = socket;
      const responseTask = waitForStreamEventResponse(
        this,
        (response, completion) => emitMessage(message, response, completion),
        responseShutdown.signal,
        responseTimeout,
      )
        .then((ack) => {
          // A delayed response belongs to the connection which delivered this event.
          if (shouldStayConnected && socket === sourceSocket)
            sendEventAck(message.headers, { ...ack });
        })
        .catch((error: unknown) => {
          this.logger.error('Failed to send DingTalk Stream event response', {
            messageId: message.headers.messageId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      pendingResponses.add(responseTask);
      void responseTask.then(() => pendingResponses.delete(responseTask));
      return;
    }
    emitMessage(message);

    sendEventAck(message.headers, { status: 'SUCCESS' });
  };

  const handleDownstream = (payload: string) => {
    let message: DownstreamMessage;
    try {
      message = JSON.parse(payload) as DownstreamMessage;
    } catch (error) {
      this.logger?.error?.('Failed to parse DingTalk stream payload', {
        error: error instanceof Error ? error.message : String(error),
        payload,
      });
      return;
    }

    // Server PING messages are acknowledged without emitting workflow items.

    switch (message.type) {
      case 'SYSTEM':
        logDebug('DingTalk stream system message received', {
          topic: message.headers.topic,
          connectionId: message.headers.connectionId,
          messageId: message.headers.messageId,
        });
        handleSystemMessage(message);
        break;
      case 'EVENT':
        logDebug('DingTalk stream event received', {
          topic: message.headers.topic,
          connectionId: message.headers.connectionId,
          messageId: message.headers.messageId,
          eventId: message.headers.eventId,
        });
        try {
          handleEventMessage(message);
        } catch (error) {
          const errMessage =
            error instanceof Error ? error.message : 'Failed to forward DingTalk event payload.';
          this.logger?.error?.('DingTalk stream event handling failed', {
            error: errMessage,
            topic: message.headers.topic,
          });
          // Ask DingTalk to retry if we failed to emit the item; avoids dropping the event silently.
          sendEventAck(message.headers, {
            status: 'LATER',
            message: errMessage,
          });
        }
        break;
      case 'CALLBACK':
        logDebug('DingTalk stream callback received', {
          topic: message.headers.topic,
          connectionId: message.headers.connectionId,
          messageId: message.headers.messageId,
        });
        try {
          handleEventMessage(message);
        } catch (error) {
          const errMessage =
            error instanceof Error ? error.message : 'Failed to forward DingTalk callback payload.';
          this.logger?.error?.('DingTalk stream callback handling failed', {
            error: errMessage,
            topic: message.headers.topic,
          });
          sendEventAck(message.headers, {
            status: 'LATER',
            message: errMessage,
          });
        }
        break;
      default:
        this.logger?.warn?.('Unknown DingTalk stream message type', {
          type: message.type,
        });
    }
  };

  const scheduleReconnect = (reason: string) => {
    if (!shouldStayConnected || manualResponseClosing || nextReconnectAt !== null) return;
    const delayMs = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** Math.min(reconnectAttempts, 6) +
        Math.floor(Math.random() * RECONNECT_BASE_DELAY_MS),
      RECONNECT_MAX_DELAY_MS,
    );
    reconnectAttempts++;
    nextReconnectAt = Date.now() + delayMs;
    this.logger.warn('DingTalk stream reconnect scheduled', {
      reason,
      delayMs,
      attempt: reconnectAttempts,
    });
  };

  const markSocketForClose = (target: WebSocket) => {
    if (target.readyState === WebSocket.CLOSED || target.readyState === WebSocket.CLOSING) return;
    try {
      target.close();
    } catch (error) {
      this.logger.warn('Failed to close DingTalk stream socket', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const releaseSocket = (target: WebSocket) => {
    if (socket === target) {
      socket = null;
      cleanupSocketListeners?.();
      cleanupSocketListeners = null;
    }
    if (pendingSocket === target) pendingSocket = null;
    markSocketForClose(target);
  };

  const disconnectSocket = (target: WebSocket, reason: string) => {
    if (socket !== target) return;
    releaseSocket(target);
    scheduleReconnect(reason);
  };

  const openConnection = async (): Promise<void> => {
    const controller = new AbortController();
    connectionAbort = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(CONNECTION_TIMEOUT_MS)]);
    let attemptSocket: WebSocket | null = null;
    let cleanupHandshake: (() => void) | undefined;
    logDebug('DingTalk stream connecting');
    try {
      // Step 1: ask DingTalk for a temporary WebSocket endpoint + ticket.
      logDebug('DingTalk stream requesting gateway endpoint');
      const gatewayResponse = (await waitWithAbort(
        this.helpers.httpRequest({
          method: 'POST',
          url: GATEWAY_URL,
          body: {
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            ua: USER_AGENT,
            subscriptions,
          },
          json: true,
          timeout: CONNECTION_TIMEOUT_MS,
          abortSignal: signal,
          headers: {
            Accept: 'application/json',
          },
        }),
        signal,
      )) as GatewayResponse;

      signal.throwIfAborted();
      if (!shouldStayConnected || manualResponseClosing) return;

      if (!gatewayResponse?.endpoint || !gatewayResponse.ticket) {
        throw new NodeOperationError(
          this.getNode(),
          'Did not receive stream endpoint information.',
        );
      }

      const url = `${gatewayResponse.endpoint}?ticket=${gatewayResponse.ticket}`;

      const ws = new WebSocket(url);
      attemptSocket = ws;
      pendingSocket = ws;

      const opening = new Promise<void>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          ws.removeEventListener('open', handleOpen);
          ws.removeEventListener('error', handleError);
          ws.removeEventListener('close', handleClose);
        };
        cleanupHandshake = cleanup;

        const handleOpen = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        };

        const handleError = (event: unknown) => {
          if (settled) return;
          settled = true;
          cleanup();
          const errorObj =
            typeof event === 'object' && event !== null && 'error' in (event as IDataObject)
              ? (event as IDataObject).error
              : event;
          reject(
            errorObj instanceof Error
              ? errorObj
              : new Error(
                  errorObj
                    ? `WebSocket connection error: ${String(errorObj)}`
                    : 'WebSocket connection error',
                ),
          );
        };

        const handleClose = () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('WebSocket closed before opening'));
        };

        ws.addEventListener('open', handleOpen);
        ws.addEventListener('error', handleError);
        ws.addEventListener('close', handleClose);
      });
      await waitWithAbort(opening, signal);
      signal.throwIfAborted();

      if (!shouldStayConnected || manualResponseClosing) {
        logDebug('DingTalk stream connect aborted; trigger stopping');
        return;
      }
      if (ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket closed before activation');
      }

      if (socket) releaseSocket(socket);
      socket = ws;
      pendingSocket = null;
      reconnectAttempts = 0;
      nextReconnectAt = null;

      const handleMessage = (event: MessageEvent) => {
        if (!shouldStayConnected || socket !== ws) return;
        if (typeof event.data === 'string') {
          handleDownstream(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          handleDownstream(Buffer.from(event.data).toString('utf8'));
        } else {
          handleDownstream(String(event.data));
        }
      };

      const handleClose = (event: CloseEvent) => {
        if (socket !== ws) return;
        logDebug('DingTalk stream closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        disconnectSocket(ws, 'socket-close');
      };

      const handleError = (event: Event | ErrorEvent) => {
        if (!shouldStayConnected || socket !== ws) return;
        const err = 'error' in event ? event.error : event;
        if (err instanceof Error || typeof err === 'string') {
          this.logger?.error?.('DingTalk stream socket error', {
            error: err instanceof Error ? err.message : String(err),
          });
        } else {
          this.logger?.error?.('DingTalk stream socket error');
        }
        disconnectSocket(ws, 'socket-error');
      };

      cleanupSocketListeners = () => {
        ws.removeEventListener('message', handleMessage);
        ws.removeEventListener('close', handleClose);
        ws.removeEventListener('error', handleError);
      };
      ws.addEventListener('message', handleMessage);
      ws.addEventListener('close', handleClose);
      ws.addEventListener('error', handleError);
      logDebug('DingTalk stream connected');
    } catch (error) {
      if (!shouldStayConnected || manualResponseClosing || controller.signal.aborted) return;
      const errMessage =
        error instanceof Error ? error.message : 'Unknown error opening DingTalk stream.';
      this.logger.warn('Failed to connect DingTalk stream websocket', { error: errMessage });
      scheduleReconnect('connect-failed');
    } finally {
      cleanupHandshake?.();
      if (attemptSocket && socket !== attemptSocket) releaseSocket(attemptSocket);
      if (connectionAbort === controller) connectionAbort = null;
    }
  };

  const connect = (): Promise<void> => {
    if (!shouldStayConnected || manualResponseClosing) return Promise.resolve();
    if (connectionTask) return connectionTask;
    nextReconnectAt = null;
    const task = openConnection();
    connectionTask = task;
    const clearTask = () => {
      if (connectionTask === task) connectionTask = null;
    };
    void task.then(clearTask, clearTask);
    return task;
  };

  const onCronTick = () => {
    if (!shouldStayConnected) return;
    sendClientPing();
  };

  const onReconnectTick = () => {
    if (!shouldStayConnected || manualResponseClosing || connectionTask) return;
    if (socket?.readyState === WebSocket.OPEN) return;
    if (socket) releaseSocket(socket);
    if (nextReconnectAt === null) scheduleReconnect('socket-not-open');
    if (nextReconnectAt !== null && Date.now() >= nextReconnectAt) void connect();
  };

  const ensureCron = () => {
    if (cronRegistered) return;
    cronRegistered = true;
    this.helpers.registerCron({ expression: CRON_EXPRESSION }, onCronTick);
    this.helpers.registerCron({ expression: RECONNECT_CRON_EXPRESSION }, onReconnectTick);
    logDebug('DingTalk stream cron registered', { expression: CRON_EXPRESSION });
  };

  shouldStayConnected = true;
  logDebug('DingTalk stream trigger initialized', {
    clientPingIntervalSeconds: CLIENT_PING_INTERVAL_SECONDS,
  });
  ensureCron();
  await connect();

  const close = async () => {
    // n8n starts manual trigger teardown before downstream nodes execute.
    if (this.getMode() === 'manual' && pendingResponses.size > 0 && !manualResponseClosing) {
      manualResponseClosing = true;
      nextReconnectAt = null;
      await Promise.allSettled([...pendingResponses]);
    }
    shouldStayConnected = false;
    nextReconnectAt = null;
    reconnectAttempts = 0;
    connectionAbort?.abort(new Error('DingTalk stream trigger stopped'));
    responseShutdown.abort();
    resolveManualIfPending();
    if (pendingSocket) releaseSocket(pendingSocket);
    if (socket) releaseSocket(socket);
    if (connectionTask) await connectionTask;
  };

  return {
    manualTriggerFunction: async () => {
      await new Promise<void>((resolve) => {
        resolveManualIfPending();
        manualResolve = resolve;
      });
    },
    closeFunction: () => {
      closePromise ??= close();
      return closePromise;
    },
  };
}
