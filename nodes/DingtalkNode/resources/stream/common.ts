import type { IExecuteResponsePromiseData, IRun, ITriggerFunctions } from 'n8n-workflow';

export const STREAM_RESPONSE_TYPE = 'dingtalk.stream.event.response';

export interface StreamEventAcknowledgement {
  status: 'SUCCESS' | 'LATER';
  message?: string;
}

type ResponsePromise = NonNullable<Parameters<ITriggerFunctions['emit']>[1]>;
type CompletionPromise = NonNullable<Parameters<ITriggerFunctions['emit']>[2]>;

function parseResponse(response: unknown): StreamEventAcknowledgement {
  const value = response as Record<string, unknown> | null | undefined;
  if (
    typeof value === 'object' &&
    value !== null &&
    value.type === STREAM_RESPONSE_TYPE &&
    (value.status === 'SUCCESS' || value.status === 'LATER') &&
    (value.message === undefined || typeof value.message === 'string')
  ) {
    return { status: value.status, message: value.message as string | undefined };
  }
  // n8n can resolve the response promise with {} when an execution ends without a response.
  return { status: 'LATER', message: 'Stream response node did not return a valid response' };
}

export function waitForStreamEventResponse(
  context: ITriggerFunctions,
  emit: (response: ResponsePromise, completion: CompletionPromise) => void,
  shutdownSignal: AbortSignal,
  timeoutSeconds: number,
): Promise<StreamEventAcknowledgement> {
  if (shutdownSignal.aborted) {
    return Promise.resolve({ status: 'LATER', message: 'Stream trigger stopped' });
  }
  const response = context.helpers.createDeferredPromise<IExecuteResponsePromiseData>();
  const completion = context.helpers.createDeferredPromise<IRun>();
  const signal = AbortSignal.any([shutdownSignal, AbortSignal.timeout(timeoutSeconds * 1000)]);

  return new Promise((resolve) => {
    let settled = false;
    const settle = (ack: StreamEventAcknowledgement) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(ack);
    };
    const onAbort = () =>
      settle({ status: 'LATER', message: 'Stream response timed out or stopped' });
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }

    // Subscribe before emit: n8n can return a response or reject execution dispatch immediately.
    void response.promise.then(
      (value) => settle(parseResponse(value)),
      () => settle({ status: 'LATER', message: 'Stream response failed' }),
    );
    void completion.promise.then(
      () => settle({ status: 'LATER', message: 'Workflow ended without a Stream response' }),
      () => settle({ status: 'LATER', message: 'Workflow failed before a Stream response' }),
    );
    try {
      emit(response, completion);
    } catch {
      settle({ status: 'LATER', message: 'Failed to start workflow' });
    }
  });
}
