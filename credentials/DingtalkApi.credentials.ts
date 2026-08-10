import type {
  IAuthenticate,
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  IHttpRequestHelper,
  INodeProperties,
  IHttpRequestOptions,
} from 'n8n-workflow';

export class DingtalkApi implements ICredentialType {
  name = 'dingtalkApi';

  displayName = 'Dingtalk API';

  icon = 'file:icon.svg' as const;

  // Link to your community node's README
  documentationUrl =
    'https://github.com/cryozerolabs/n8n-nodes-dingtalk?tab=readme-ov-file#-%E8%BA%AB%E4%BB%BD%E9%AA%8C%E8%AF%81%E9%85%8D%E7%BD%AE';

  properties: INodeProperties[] = [
    {
      displayName: '组织ID (Corp ID)',
      name: 'corpId',
      type: 'string',
      required: true,
      default: '',
      description: '钉钉组织ID，应用运行在哪个组织就填写哪个组织的corpId',
    },
    {
      displayName: '应用ID (Client ID)',
      name: 'clientId',
      type: 'string',
      required: true,
      default: '',
      description: '应用的ClientID',
    },
    {
      displayName: '应用密钥 (Client Secret)',
      name: 'clientSecret',
      type: 'string',
      typeOptions: { password: true },
      required: true,
      default: '',
      description: '应用的ClientSecret',
    },
    {
      displayName: 'AccessToken',
      name: 'accessToken',
      type: 'hidden',
      default: '',
      typeOptions: {
        password: true,
        expirable: true,
      },
      description: '自动获取的AccessToken',
    },
    {
      displayName: '操作人ID（unionId）',
      name: 'userUnionId',
      type: 'string',
      default: '',
      hint: '如果你已经获取了操作人Union ID，可以在这里填写，否则需要通过[用户管理 查询用户详情]获取后，再填写',
    },
  ];

  async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
    const res = await this.helpers.httpRequest({
      method: 'POST',
      url: `https://api.dingtalk.com/v1.0/oauth2/accessToken`,
      allowedDomains: 'api.dingtalk.com',
      body: {
        appKey: credentials.clientId,
        appSecret: credentials.clientSecret,
      },
    });

    const accessToken = res.accessToken || res.access_token;
    if (res.code || !accessToken) {
      throw new Error(`授权失败: ${res.message}`);
    }
    return { accessToken };
  }

  authenticate: IAuthenticate = async (
    credentials: ICredentialDataDecryptedObject,
    requestOptions: IHttpRequestOptions,
  ) => {
    const baseURL = requestOptions.baseURL ?? '';
    const url = requestOptions.url ?? '';
    let target: URL;
    try {
      target = new URL(url, baseURL || undefined);
    } catch {
      throw new Error('Dingtalk API 凭证需要合法的钉钉 API URL');
    }

    if (target.protocol !== 'https:' || (target.port && target.port !== '443')) {
      throw new Error('Dingtalk API 凭证只允许通过 HTTPS 访问钉钉 API');
    }

    // 清除用户手工填写的同名认证字段，确保最终只发送凭据管理的 token。
    let removedUrlToken = false;
    for (const key of [...target.searchParams.keys()]) {
      if (key.toLowerCase() === 'access_token') {
        target.searchParams.delete(key);
        removedUrlToken = true;
      }
    }
    if (removedUrlToken) requestOptions.url = target.toString();

    const qs = { ...(requestOptions.qs ?? {}) };
    for (const key of Object.keys(qs)) {
      if (key.toLowerCase() === 'access_token') delete qs[key];
    }
    requestOptions.qs = qs;

    const headers = { ...(requestOptions.headers ?? {}) };
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'x-acs-dingtalk-access-token') delete headers[key];
    }
    requestOptions.headers = headers;

    if (target.hostname === 'oapi.dingtalk.com') {
      // 兼容旧版api，只认query上的access_token
      requestOptions.qs = {
        ...qs,
        access_token: credentials.accessToken,
      };
    } else if (target.hostname === 'api.dingtalk.com') {
      // 新版本api，走header上的access_token
      requestOptions.headers = {
        ...headers,
        'x-acs-dingtalk-access-token': credentials.accessToken,
      };
    } else {
      throw new Error(
        'Dingtalk API 凭证只允许访问 api.dingtalk.com 或 oapi.dingtalk.com',
      );
    }

    // console.debug('authenticate', {
    // 	url: requestOptions.url,
    // 	baseURL: requestOptions.baseURL,
    // 	queryToken: requestOptions.qs?.access_token,
    // 	headerToken: requestOptions.headers?.['x-acs-dingtalk-access-token'],
    // });

    return requestOptions;
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://api.dingtalk.com/v1.0',
      url: '=/oauth2/accessToken',
      method: 'POST',
      body: {
        appKey: '={{$credentials.clientId}}',
        appSecret: '={{$credentials.clientSecret}}',
      },
    },
  };
}
