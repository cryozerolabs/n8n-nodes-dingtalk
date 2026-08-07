import { NodeApiError } from 'n8n-workflow';
import type {
  IExecuteFunctions,
  ILoadOptionsFunctions,
  IHttpRequestOptions,
  JsonObject,
} from 'n8n-workflow';

type Ctx = IExecuteFunctions | ILoadOptionsFunctions;
type RequestExtras = {
  credentialType?: string;
  supportsTokenRefresh?: boolean;
};

const DEFAULT_BASE_URL = 'https://api.dingtalk.com/v1.0';

function isAbsoluteUrl(u?: string): boolean {
  return !!u && /^https?:\/\//i.test(u);
}

function normalizeUrl(u?: string): string | undefined {
  if (!u) return u;
  if (!u.startsWith('http') && !u.startsWith('/')) return `/${u}`;
  return u;
}

function hasTokenErrorCode(body: unknown): boolean {
  if (typeof body === 'string') {
    return /\b(?:errcode|subcode)\b["']?\s*[:=]\s*["']?40014\b/i.test(body);
  }
  if (typeof body !== 'object' || body === null) return false;

  const response = body as Record<string, unknown>;
  return [response.errcode, response.subcode].some((code) => String(code) === '40014');
}

function looksLikeTokenProblem(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  if (hasTokenErrorCode(body)) return true;

  let serialized: string;
  if (typeof body === 'string') {
    serialized = body;
  } else if (body instanceof Error) {
    serialized = body.message;
  } else {
    try {
      const value = JSON.stringify(body);
      if (!value) return false;
      serialized = value;
    } catch {
      return false;
    }
  }

  const s = serialized.toLowerCase();
  const mentionsAccessToken = /access[\s_-]*token/.test(s);
  const describesInvalidToken =
    /\b(?:blank|invalid|expired)\b/.test(s) ||
    s.includes('非法') ||
    s.includes('不合法') ||
    s.includes('过期') ||
    s.includes('失效') ||
    s.includes('超时');

  // 兼容 accessToken、access_token、access token 等常见错误文本。
  return (mentionsAccessToken && describesInvalidToken) || s.includes('应用尚未开通所需的权限');
}

function createResponseError(response: unknown): Error & { context: { data: unknown } } {
  const data =
    typeof response === 'object' && response !== null
      ? (response as Record<string, unknown>)
      : undefined;
  const rawMessage = data?.errmsg ?? data?.message;
  const rawCode = data?.errcode ?? data?.code;
  const message =
    typeof rawMessage === 'string' && rawMessage.length > 0
      ? rawMessage
      : rawCode !== undefined
        ? `DingTalk API error (${String(rawCode)})`
        : 'DingTalk API request failed';
  const error = new Error(message) as Error & { context: { data: unknown } };
  error.context = { data: response };
  return error;
}

async function originRequest(
  this: Ctx,
  options: IHttpRequestOptions,
  credentialType: string,
  clearAccessToken = false,
) {
  // 读取已保存的凭据，并可在本次请求"临时覆盖 accessToken"
  const credentials = await (this as IExecuteFunctions).getCredentials(credentialType);

  const url = normalizeUrl(options.url);
  if (!url) {
    throw new Error('Request options require a URL');
  }
  // 相对地址自动补 baseURL
  const baseURL = options.baseURL ?? (isAbsoluteUrl(url) ? undefined : DEFAULT_BASE_URL);

  // 设置默认值
  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const mergedOptions = {
    ...options,
    url,
    baseURL,
    json: options.json ?? true,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    qs: options.qs,
  };

  // 统一打点: 发出前
  this.logger?.debug?.('request (before)', {
    method: mergedOptions.method,
    url,
    baseURL,
    qs: mergedOptions.qs,
    headers: Object.keys(mergedOptions.headers),
    json: mergedOptions.json,
    body: mergedOptions.body,
    hasAccessToken: Boolean(credentials.accessToken),
    clearAccessToken,
  });

  const resp = await this.helpers.httpRequestWithAuthentication.call(
    this,
    credentialType,
    mergedOptions as IHttpRequestOptions,
    {
      // 用临时的"解密凭据覆盖"，让 accessToken 可被清空，从而触发 preAuthentication 重新取
      // @ts-expect-error n8n 内部允许这个第三参
      credentialsDecrypted: {
        data: {
          ...credentials,
          accessToken: clearAccessToken ? '' : credentials.accessToken,
        },
      },
    },
  );

  // 统一打点: 收到后
  this.logger?.debug?.('response (after)', {
    response: resp,
  });

  // 检查错误, 如果errcode存在则抛出错误，而不是当作成功返回
  if (resp.errcode) {
    throw createResponseError(resp);
  }

  return resp;
}

export async function request<T = unknown>(
  this: Ctx,
  options: IHttpRequestOptions,
  extras: RequestExtras = {},
): Promise<T> {
  const credentialType = extras.credentialType ?? 'dingtalkApi';
  const supportsTokenRefresh = extras.supportsTokenRefresh ?? credentialType === 'dingtalkApi';
  const maxAttempts = supportsTokenRefresh ? 2 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let data: unknown;
    try {
      data = await originRequest.call(this, options, credentialType, attempt > 0);
    } catch (err) {
      const e = err as {
        context?: { data?: unknown };
        description?: unknown;
        message?: unknown;
      };

      this.logger?.error?.('request (error)', {
        context: e.context,
        description: e.description,
        message: e.message,
      });

      const maybeAuth = [e.context?.data, e.description, e.message, err].some(
        looksLikeTokenProblem,
      );

      if (supportsTokenRefresh && attempt === 0 && maybeAuth) {
        // 清空 token 触发 preAuthentication 重新获取，再试一次
        continue;
      }
      // 非鉴权问题或刷新后仍失败时，统一包装为 n8n API 错误
      throw new NodeApiError(this.getNode(), err as JsonObject);
    }

    if (supportsTokenRefresh && looksLikeTokenProblem(data)) {
      if (attempt === 0) continue;
      throw new NodeApiError(this.getNode(), createResponseError(data) as unknown as JsonObject);
    }
    return data as T;
  }

  throw new Error('DingTalk request exhausted all retry attempts');
}
