import type {
  IDataObject,
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { parseJsonBody } from '../../../shared/properties/body';
import { request } from '../../../shared/request';

const OP = 'api.request';
const showOnly = { show: { operation: [OP] } };

const ALLOWED_HOSTS = new Set(['api.dingtalk.com', 'oapi.dingtalk.com']);
const ALLOWED_DOMAINS = 'api.dingtalk.com,oapi.dingtalk.com';
const ALLOWED_METHODS = new Set<IHttpRequestMethods>([
  'DELETE',
  'GET',
  'HEAD',
  'PATCH',
  'POST',
  'PUT',
]);
const BODY_METHODS = new Set<IHttpRequestMethods>(['DELETE', 'PATCH', 'POST', 'PUT']);
const FORBIDDEN_QUERY_NAMES = new Map([
  ['access_token', 'access_token 由 Dingtalk API 凭证自动注入，无需手工填写'],
]);
const FORBIDDEN_HEADER_NAMES = new Map([
  [
    'x-acs-dingtalk-access-token',
    'x-acs-dingtalk-access-token 由 Dingtalk API 凭证自动注入，无需手工填写',
  ],
  ['host', '自定义 API 请求不允许覆盖 Host 请求头'],
  ['content-length', '自定义 API 请求不允许手工设置 Content-Length 请求头'],
  ['transfer-encoding', '自定义 API 请求不允许手工设置 Transfer-Encoding 请求头'],
  ['connection', '自定义 API 请求不允许手工设置 Connection 请求头'],
  ['proxy-authorization', '自定义 API 请求不允许设置 Proxy-Authorization 请求头'],
]);

type KeyValueCollection = {
  parameters?: Array<{ name?: unknown; value?: unknown }>;
};

function parameterError(message: string): Error {
  return new Error(message);
}

function rejectManualTokenInUrl(url: URL): void {
  for (const key of url.searchParams.keys()) {
    if (key.toLowerCase() === 'access_token') {
      throw parameterError('无需在 URL 中填写 access_token，Dingtalk API 凭证会自动注入');
    }
  }
}

export function resolveDingTalkUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw parameterError('API URL 不是合法的完整 URL');
  }

  if (parsed.protocol !== 'https:') {
    throw parameterError('自定义 API 请求只允许使用 HTTPS');
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw parameterError('API URL 只能使用 api.dingtalk.com 或 oapi.dingtalk.com');
  }
  if (parsed.port && parsed.port !== '443') {
    throw parameterError('API URL 只能使用默认 HTTPS 端口 443');
  }
  if (parsed.username || parsed.password) {
    throw parameterError('API URL 不能包含用户名或密码');
  }
  if (parsed.hash) {
    throw parameterError('API URL 不能包含 fragment');
  }

  rejectManualTokenInUrl(parsed);
  return parsed.toString();
}

function collectionToObject(
  raw: unknown,
  label: string,
  forbiddenNames: ReadonlyMap<string, string> = new Map(),
): IDataObject {
  const entries = (raw as KeyValueCollection | undefined)?.parameters ?? [];
  if (!Array.isArray(entries)) throw parameterError(`${label} 的格式不正确`);

  const result: IDataObject = {};
  for (const entry of entries) {
    const name = String(entry?.name ?? '').trim();
    const value = entry?.value ?? '';
    if (!name && String(value) === '') continue;
    if (!name) throw parameterError(`${label} 中存在没有名称的参数`);
    const forbiddenMessage = forbiddenNames.get(name.toLowerCase());
    if (forbiddenMessage) throw parameterError(forbiddenMessage);
    result[name] = value as IDataObject[string];
  }
  return result;
}

function keyValueCollectionProperty(args: {
  displayName: string;
  name: string;
  description: string;
}): INodeProperties {
  return {
    displayName: args.displayName,
    name: args.name,
    type: 'fixedCollection',
    default: {},
    placeholder: 'Add Parameter',
    description: args.description,
    displayOptions: showOnly,
    typeOptions: { multipleValues: true },
    options: [
      {
        displayName: 'Parameters',
        name: 'parameters',
        values: [
          {
            displayName: 'Name',
            name: 'name',
            type: 'string',
            default: '',
          },
          {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
          },
        ],
      },
    ],
  };
}

const properties: INodeProperties[] = [
  {
    displayName: 'Method',
    name: 'method',
    type: 'options',
    noDataExpression: true,
    options: [
      { name: 'DELETE', value: 'DELETE' },
      { name: 'GET', value: 'GET' },
      { name: 'HEAD', value: 'HEAD' },
      { name: 'PATCH', value: 'PATCH' },
      { name: 'POST', value: 'POST' },
      { name: 'PUT', value: 'PUT' },
    ],
    default: 'GET',
    displayOptions: showOnly,
  },
  {
    displayName: 'API URL',
    name: 'url',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'https://api.dingtalk.com/v1.0/contact/users/me',
    description:
      '粘贴钉钉开放平台文档中的完整 API 地址；只允许 api.dingtalk.com 和 oapi.dingtalk.com 的 HTTPS 地址',
    displayOptions: showOnly,
  },
  keyValueCollectionProperty({
    displayName: 'Query Parameters',
    name: 'queryParameters',
    description: '追加到 URL 的查询参数；access_token 会由凭证自动管理',
  }),
  keyValueCollectionProperty({
    displayName: 'Headers',
    name: 'headers',
    description: '附加请求头；x-acs-dingtalk-access-token 会由凭证自动管理',
  }),
  {
    displayName: '发送请求体',
    name: 'sendBody',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        operation: [OP],
        method: ['DELETE', 'PATCH', 'POST', 'PUT'],
      },
    },
  },
  {
    displayName: '请求体 JSON',
    name: 'jsonBody',
    type: 'json',
    default: '{}',
    description: '发送给钉钉 API 的 JSON 对象',
    displayOptions: {
      show: {
        operation: [OP],
        method: ['DELETE', 'PATCH', 'POST', 'PUT'],
        sendBody: [true],
      },
    },
  },
];

const op: OperationDef = {
  value: OP,
  name: '发送请求',
  action: '自定义 API 请求',
  description: '调用尚未封装的钉钉 JSON API，并自动处理 access token 刷新',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const method = this.getNodeParameter('method', itemIndex) as IHttpRequestMethods;
    if (!ALLOWED_METHODS.has(method)) {
      throw new NodeOperationError(this.getNode(), `不支持请求方法 ${String(method)}`, {
        itemIndex,
      });
    }
    let url: string;
    try {
      url = resolveDingTalkUrl(this.getNodeParameter('url', itemIndex, '') as string);
    } catch (error) {
      throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
    }

    let qs: IDataObject;
    let headers: IDataObject;
    try {
      qs = collectionToObject(
        this.getNodeParameter('queryParameters', itemIndex, {}),
        'Query Parameters',
        FORBIDDEN_QUERY_NAMES,
      );
      headers = collectionToObject(
        this.getNodeParameter('headers', itemIndex, {}),
        'Headers',
        FORBIDDEN_HEADER_NAMES,
      );
    } catch (error) {
      throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
    }

    const sendBody =
      BODY_METHODS.has(method) &&
      (this.getNodeParameter('sendBody', itemIndex, false) as boolean);
    const body = sendBody
      ? (parseJsonBody(
          this.getNodeParameter('jsonBody', itemIndex, {}),
          this.getNode(),
          itemIndex,
        ) as IDataObject)
      : undefined;

    const resp = await request.call(this, {
      method,
      url,
      qs,
      headers,
      body,
      allowedDomains: ALLOWED_DOMAINS,
    });

    const json =
      typeof resp === 'object' && resp !== null && !Array.isArray(resp)
        ? (resp as IDataObject)
        : ({ data: resp ?? null } as IDataObject);

    return { json, pairedItem: { item: itemIndex } };
  },
};

export default op;
