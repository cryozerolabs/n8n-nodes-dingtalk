import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import type { IHttpRequestOptions, IRequestOptions } from 'n8n-workflow/dist/Interfaces';

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

function looksLikeTokenProblem(body: unknown): boolean {
  if (body === undefined || body === null) return false;

  let serialized: string;
  if (typeof body === 'string') {
    serialized = body;
  } else {
    try {
      serialized = JSON.stringify(body);
    } catch {
      return false;
    }
  }

  const s = serialized.toLowerCase();
  // 常见提示: access_token is blank / invalid / expired / 不合法 等
  return (
    (s.includes('access_token') &&
      (s.includes('blank') ||
        s.includes('invalid') ||
        s.includes('expired') ||
        s.includes('非法') ||
        s.includes('不合法'))) ||
    s.includes('应用尚未开通所需的权限')
  );
}

async function originRequest(
  this: Ctx,
  options: IRequestOptions,
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
    accessToken: credentials.accessToken,
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
    throw new Error(resp.errmsg);
  }

  return resp;
}

export async function request<T = unknown>(
  this: Ctx,
  options: IRequestOptions,
  extras: RequestExtras = {},
): Promise<T> {
  const credentialType = extras.credentialType ?? 'dingtalkApi';
  const supportsTokenRefresh = extras.supportsTokenRefresh ?? credentialType === 'dingtalkApi';

  try {
    const data = await originRequest.call(this, options, credentialType, false);
    if (supportsTokenRefresh && looksLikeTokenProblem(data)) {
      // 清空 token 触发 preAuthentication 重新获取，再试一次
      const retry = await originRequest.call(this, options, credentialType, true);
      return retry as T;
    }
    return data as T;
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

    const maybeAuth = looksLikeTokenProblem(e.context?.data ?? e.description ?? err);

    if (supportsTokenRefresh && maybeAuth) {
      // 清空 token 触发 preAuthentication 重新获取，再试一次
      const retry = await originRequest.call(this, options, credentialType, true);
      return retry as T;
    }
    // 非鉴权问题直接抛出
    throw err;
  }
}
