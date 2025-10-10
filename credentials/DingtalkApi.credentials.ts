import type {
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  IHttpRequestHelper,
  INodeProperties,
} from 'n8n-workflow';
import { IHttpRequestOptions } from 'n8n-workflow/dist/Interfaces';

export class DingtalkApi implements ICredentialType {
  name = 'dingtalkApi';

  displayName = 'Dingtalk API';

  icon = 'file:icon.png' as const;

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
      url: `https://api.dingtalk.com/v1.0/oauth2/${credentials.corpId}/token`,
      body: {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: 'client_credentials',
      },
    });

    if (res.code || !res.access_token) {
      throw new Error(`授权失败: ${res.message}`);
    }
    return { accessToken: res.access_token };
  }

  async authenticate(
    credentials: ICredentialDataDecryptedObject,
    requestOptions: IHttpRequestOptions,
  ): Promise<IHttpRequestOptions> {
    const baseURL = requestOptions.baseURL ?? '';
    const url = requestOptions.url ?? '';
    const full = url.startsWith('http') ? url : `${baseURL}${url}`;

    if (full.includes('oapi.dingtalk.com')) {
      // 兼容旧版api，只认query上的access_token
      requestOptions.qs = {
        ...(requestOptions.qs ?? {}),
        access_token: credentials.accessToken,
      };
    } else {
      // 新版本api，走header上的access_token
      requestOptions.headers = {
        ...(requestOptions.headers ?? {}),
        'x-acs-dingtalk-access-token': credentials.accessToken,
      };
    }

    // console.debug('authenticate', {
    // 	url: requestOptions.url,
    // 	baseURL: requestOptions.baseURL,
    // 	queryToken: requestOptions.qs?.access_token,
    // 	headerToken: requestOptions.headers?.['x-acs-dingtalk-access-token'],
    // });

    return requestOptions;
  }

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://api.dingtalk.com/v1.0',
      url: '=/oauth2/{{$credentials.corpId}}/token',
      method: 'POST',
      body: {
        client_id: '={{$credentials.clientId}}',
        client_secret: '={{$credentials.clientSecret}}',
        grant_type: 'client_credentials',
      },
    },
  };
}
