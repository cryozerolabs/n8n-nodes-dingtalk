import {
  NodeOperationError,
  type CronExpression,
  type IDataObject,
  type INodeProperties,
  type ITriggerFunctions,
  type ITriggerResponse,
} from 'n8n-workflow';

// DingTalk's Stream gateway meta. Ticket validity isn't documented precisely, so we reconnect
// whenever the socket closes or fails.
const GATEWAY_URL = 'https://api.dingtalk.com/v1.0/gateway/connections/open';
const USER_AGENT = 'n8n-nodes-dingtalk-trigger';
const CLIENT_PING_INTERVAL_SECONDS = 30;
const CRON_EXPRESSION: CronExpression = `*/${CLIENT_PING_INTERVAL_SECONDS} * * * * *`;
const DEBUG_STREAM = false;

interface DingtalkCredentials {
  clientId?: string;
  clientSecret?: string;
}

type DownstreamKind = 'SYSTEM' | 'EVENT';

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

// Keep exported for future per-trigger parameters; presently the Stream trigger has no options.
export const streamPushTriggerOptions: INodeProperties[] = [];

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

  const subscriptions = [{ type: 'EVENT', topic: '*' }] as Array<{ type: string; topic: string }>;

  let socket: WebSocket | null = null;
  let pendingSocket: WebSocket | null = null;
  let shouldStayConnected = true;
  let connectInProgress = false;
  let manualResolve: (() => void) | null = null;
  let reconnectQueued = false;
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
      markSocketForClose(socket);
    }
  };

  // Push the inbound payload into the workflow; the original JSON string is returned in rawData.
  const emitMessage = (message: DownstreamMessage) => {
    const parsedData = safeParse(message.data);
    const payload: IDataObject = {
      type: message.type,
      specVersion: message.specVersion,
      headers: message.headers as unknown as IDataObject,
      data: parsedData as IDataObject | IDataObject[] | string | number | boolean | null,
      rawData: message.data,
      receivedAt: new Date().toISOString(),
    };

    this.emit([this.helpers.returnJsonArray([payload])]);
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

  // For normal events we emit and immediately ACK SUCCESS.
  const handleEventMessage = (message: DownstreamMessage) => {
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
      default:
        this.logger?.warn?.('Unknown DingTalk stream message type', {
          type: message.type,
        });
    }
  };

  const scheduleReconnect = (reason: string) => {
    if (!shouldStayConnected) return;
    if (reconnectQueued) return;
    reconnectQueued = true;
    logDebug('DingTalk stream reconnect queued', { reason });
    void Promise.resolve().then(async () => {
      reconnectQueued = false;
      await connect();
    });
  };

  const markSocketForClose = (target: WebSocket) => {
    target.close();
  };

  const connect = async (): Promise<void> => {
    if (!shouldStayConnected || connectInProgress) return;
    connectInProgress = true;
    logDebug('DingTalk stream connecting');
    try {
      // Step 1: ask DingTalk for a temporary WebSocket endpoint + ticket.
      logDebug('DingTalk stream requesting gateway endpoint');
      const gatewayResponse = (await this.helpers.httpRequest({
        method: 'POST',
        url: GATEWAY_URL,
        body: {
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          ua: USER_AGENT,
          subscriptions,
        },
        json: true,
        headers: {
          Accept: 'application/json',
        },
      })) as GatewayResponse;

      if (!gatewayResponse?.endpoint || !gatewayResponse.ticket) {
        throw new NodeOperationError(
          this.getNode(),
          'Did not receive stream endpoint information.',
        );
      }

      const url = `${gatewayResponse.endpoint}?ticket=${gatewayResponse.ticket}`;

      const ws = new WebSocket(url);
      pendingSocket = ws;

      await new Promise<void>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          ws.removeEventListener('open', handleOpen);
          ws.removeEventListener('error', handleError);
          ws.removeEventListener('close', handleClose);
        };

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

      if (!shouldStayConnected) {
        logDebug('DingTalk stream connect aborted; trigger stopping');
        markSocketForClose(ws);
        pendingSocket = null;
        return;
      }

      if (
        socket &&
        socket.readyState !== WebSocket.CLOSED &&
        socket.readyState !== WebSocket.CLOSING
      ) {
        markSocketForClose(socket);
      }

      socket = ws;
      pendingSocket = null;
      logDebug('DingTalk stream connected');

      ws.addEventListener('message', (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          handleDownstream(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          handleDownstream(Buffer.from(event.data).toString('utf8'));
        } else {
          handleDownstream(String(event.data));
        }
      });

      const clearSocketReferences = () => {
        if (socket === ws) {
          socket = null;
        }
        if (pendingSocket === ws) {
          pendingSocket = null;
        }
      };

      ws.addEventListener('close', (event: CloseEvent) => {
        if (socket !== ws && pendingSocket !== ws) {
          return;
        }
        clearSocketReferences();
        logDebug('DingTalk stream closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        if (shouldStayConnected) {
          scheduleReconnect('socket-close');
        }
      });

      ws.addEventListener('error', (event: Event | ErrorEvent) => {
        const err = 'error' in event ? event.error : event;
        if (err instanceof Error || typeof err === 'string') {
          this.logger?.error?.('DingTalk stream socket error', {
            error: err instanceof Error ? err.message : String(err),
          });
        } else {
          this.logger?.error?.('DingTalk stream socket error');
        }
        if (
          (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) &&
          (socket === ws || pendingSocket === ws)
        ) {
          logDebug('DingTalk stream socket error; closing socket');
          markSocketForClose(ws);
        }
      });
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Unknown error opening DingTalk stream.';
      this.logger.warn('Failed to connect DingTalk stream websocket', { error: errMessage });
      pendingSocket = null;
      scheduleReconnect('connect-failed');
    } finally {
      connectInProgress = false;
    }
  };

  const onCronTick = () => {
    if (!shouldStayConnected) return;
    sendClientPing();
    if (!connectInProgress && (!socket || socket.readyState === WebSocket.CLOSED)) {
      logDebug('DingTalk stream reconnect due; starting new connection');
      void connect();
    }
  };

  const ensureCron = () => {
    if (cronRegistered) return;
    cronRegistered = true;
    this.helpers.registerCron({ expression: CRON_EXPRESSION }, onCronTick);
    logDebug('DingTalk stream cron registered', { expression: CRON_EXPRESSION });
  };

  shouldStayConnected = true;
  logDebug('DingTalk stream trigger initialized', {
    clientPingIntervalSeconds: CLIENT_PING_INTERVAL_SECONDS,
  });
  ensureCron();
  await connect();

  return {
    manualTriggerFunction: async () => {
      await new Promise<void>((resolve) => {
        resolveManualIfPending();
        manualResolve = resolve;
      });
    },
    closeFunction: async () => {
      shouldStayConnected = false;
      reconnectQueued = false;
      if (pendingSocket) {
        logDebug('DingTalk stream closing pending socket');
        markSocketForClose(pendingSocket);
        pendingSocket = null;
      }
      resolveManualIfPending();
      if (socket) {
        logDebug('DingTalk stream closing active socket');
        markSocketForClose(socket);
      }
      socket = null;
    },
  };
}
