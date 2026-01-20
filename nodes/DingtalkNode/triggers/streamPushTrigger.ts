import {
  NodeOperationError,
  type IDataObject,
  type INodeProperties,
  type ITriggerFunctions,
  type ITriggerResponse,
} from 'n8n-workflow';

// DingTalk's Stream gateway meta. Ticket validity isn't documented precisely, so we reconnect
// aggressively whenever the server tells us to or the heartbeat times out.
const GATEWAY_URL = 'https://api.dingtalk.com/v1.0/gateway/connections/open';
const USER_AGENT = 'n8n-nodes-dingtalk-trigger';
const HEARTBEAT_TIMEOUT_MS = 60_000;
const RECONNECT_DELAY_MS = 5_000;

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
  const credentials = (await this.getCredentials('dingtalkApi')) as DingtalkCredentials;
  if (!credentials?.clientId || !credentials?.clientSecret) {
    throw new NodeOperationError(
      this.getNode(),
      'Missing DingTalk credentials. Please configure Client ID and Client Secret.',
    );
  }

  const keepAlive = true; // honour DingTalk's ping/pong and drop the socket on timeout.
  const subscriptions = [{ type: 'EVENT', topic: '*' }] as Array<{ type: string; topic: string }>;

  let socket: WebSocket | null = null;
  let shouldStayConnected = true;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let lastHeartbeat = Date.now();
  let manualResolve: (() => void) | null = null;
  let manualTimeout: NodeJS.Timeout | null = null;

  const resolveManualIfPending = () => {
    if (manualTimeout) {
      clearTimeout(manualTimeout);
      manualTimeout = null;
    }
    if (manualResolve) {
      manualResolve();
      manualResolve = null;
    }
  };

  const sendSocketMessage = (payload: IDataObject) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(payload));
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

  const updateHeartbeat = () => {
    lastHeartbeat = Date.now();
  };

  const stopHeartbeatMonitor = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const startHeartbeatMonitor = () => {
    stopHeartbeatMonitor();
    if (!keepAlive) return;
    heartbeatTimer = setInterval(() => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const staleFor = Date.now() - lastHeartbeat;
      if (staleFor > HEARTBEAT_TIMEOUT_MS) {
        socket.close();
      }
    }, HEARTBEAT_TIMEOUT_MS / 2);
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
    updateHeartbeat();
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

    updateHeartbeat();

    switch (message.type) {
      case 'SYSTEM':
        handleSystemMessage(message);
        break;
      case 'EVENT':
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

  const scheduleReconnect = () => {
    if (!shouldStayConnected) return;
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, RECONNECT_DELAY_MS);
  };

  const connect = async (): Promise<void> => {
    if (!shouldStayConnected) return;

    try {
      // Step 1: ask DingTalk for a temporary WebSocket endpoint + ticket.
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

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }

      socket = ws;
      updateHeartbeat();
      startHeartbeatMonitor();

      ws.addEventListener('message', (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          handleDownstream(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          handleDownstream(Buffer.from(event.data).toString('utf8'));
        } else {
          handleDownstream(String(event.data));
        }
      });

      ws.addEventListener('close', () => {
        stopHeartbeatMonitor();
        socket = null;
        if (shouldStayConnected) {
          scheduleReconnect();
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
      });
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Unknown error opening DingTalk stream.';
      this.logger?.error?.('Failed to connect DingTalk stream websocket', { error: errMessage });
      scheduleReconnect();
    }
  };

  shouldStayConnected = true;
  await connect();

  return {
    manualTriggerFunction: async () => {
      await new Promise<void>((resolve) => {
        manualResolve = resolve;
        manualTimeout = setTimeout(() => {
          manualResolve = null;
          manualTimeout = null;
          resolve();
        }, 60_000);
      });
    },
    closeFunction: async () => {
      shouldStayConnected = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      resolveManualIfPending();
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      socket = null;
    },
  };
}
