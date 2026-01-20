import type {
  IAuthenticate,
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  IDataObject,
  IHttpRequestOptions,
  INodeProperties,
} from 'n8n-workflow';
import { createHmac } from 'node:crypto';

export class DingtalkRobotApi implements ICredentialType {
  name = 'dingtalkRobotApi';

  displayName = 'DingTalk Robot API';

  test: ICredentialTestRequest = {
    request: {
      method: 'POST',
      baseURL: 'https://oapi.dingtalk.com/robot/send',
      url: '',
      body: {},
    },
  };

  icon = 'file:icon.svg' as const;

  documentationUrl =
    'https://open.dingtalk.com/document/development/custom-robots-send-group-messages';

  properties: INodeProperties[] = [
    {
      displayName: 'AccessToken',
      name: 'accessToken',
      type: 'string',
      required: true,
      default: '',
      placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=<TOKEN>',
      typeOptions: {
        password: true,
      },
      description:
        '自定义机器人安装后webhook地址中的access_token值。详情参考<a href="https://open.dingtalk.com/document/development/custom-robots-send-group-messages" target="_blank">获取自定义机器人 Webhook 地址</a>。',
    },
    {
      displayName: '签名密钥(可选)',
      name: 'secret',
      type: 'string',
      default: '',
      placeholder: 'SECxxx',
      typeOptions: {
        password: true,
      },
      description:
        '如果启用了加签校验，请填写密钥，n8n 会自动生成 sign 与 timestamp 参数。<a href="https://open.dingtalk.com/document/robots/customize-robot-security-settings" target="_blank">查看官方API文档</a>',
    },
  ];

  authenticate: IAuthenticate = async (
    credentials: ICredentialDataDecryptedObject,
    requestOptions: IHttpRequestOptions,
  ) => {
    const qs: IDataObject = {
      access_token: credentials.accessToken,
    };

    if (credentials.secret) {
      // 时间戳
      const timestamp = Date.now();
      // 签名
      const base64Sign = createHmac('sha256', credentials.secret as string)
        .update(`${timestamp}\n${credentials.secret}`)
        .digest('base64');
      // base64 encode, 然后再url encode
      const sign = encodeURIComponent(base64Sign);

      qs.timestamp = timestamp;
      qs.sign = sign;
    }

    requestOptions.qs = {
      ...(requestOptions.qs ?? {}),
      ...qs,
    };

    return requestOptions;
  };
}
