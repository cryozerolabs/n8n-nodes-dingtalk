import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import type { IRequestOptions } from 'n8n-workflow/dist/Interfaces';

type Ctx = IExecuteFunctions | ILoadOptionsFunctions;

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
  try {
    const s = JSON.stringify(body ?? {}).toLowerCase();
    // 常见提示：access_token is blank / invalid / expired / 不合法 等
    return (
      s.includes('access_token') &&
      (s.includes('blank') ||
        s.includes('invalid') ||
        s.includes('expired') ||
        s.includes('非法') ||
        s.includes('不合法'))
    );
  } catch {
    return false;
  }
}

async function originRequest(this: Ctx, options: IRequestOptions, clearAccessToken = false) {
  // 读取已保存的凭据，并可在本次请求“临时覆盖 accessToken”
  const credentials = await (this as IExecuteFunctions).getCredentials('dingtalkApi');

  const url = normalizeUrl(options.url);
  // 相对地址自动补 baseURL
  const baseURL = options.baseURL ?? (isAbsoluteUrl(url) ? undefined : DEFAULT_BASE_URL);

  // 统一打点：发出前
  this.logger?.debug?.('request (before)', {
    method: options.method,
    url,
    baseURL,
    qs: options.qs,
    headers: options.headers ? Object.keys(options.headers) : undefined,
    json: options.json,
  });

  const resp = await this.helpers.requestWithAuthentication.call(
    this,
    'dingtalkApi',
    { ...options, url, baseURL, json: options.json ?? true },
    {
      // 关键：用临时的“解密凭据覆盖”，让 accessToken 可被清空，从而触发 preAuthentication 重新取
      // @ts-expect-error n8n 内部允许这个第三参
      credentialsDecrypted: {
        data: {
          ...credentials,
          // 关键：调试时第一发用坏 token；或清空以触发 preAuthentication
          accessToken: clearAccessToken ? '' : credentials.accessToken,
        },
      },
    },
  );

  // 统一打点：收到后
  this.logger?.debug?.('response (after)', {
    url: options.url,
    status: resp?.statusCode ?? resp?.status ?? 'ok',
    tokenHint: looksLikeTokenProblem(resp),
  });

  return resp;
}

export async function request<T = unknown>(this: Ctx, options: IRequestOptions): Promise<T> {
  try {
    const data = await originRequest.call(this, options, false);
    // 清空 token 触发 preAuthentication 重新获取，再试一次
    if (looksLikeTokenProblem(data)) {
      const retry = await originRequest.call(this, options, true);
      return retry as T;
    }
    return data as T;
  } catch (err) {
    const e = err as { statusCode?: number; response?: { statusCode?: number; body?: unknown } };
    const maybeAuth = looksLikeTokenProblem(e.response?.body);
    if (maybeAuth) {
      // 清空 token 触发 preAuthentication 重新获取，再试一次
      const retry = await originRequest.call(this, options, true);
      return retry as T;
    }
    // 非鉴权问题直接抛出
    throw err;
  }
}
