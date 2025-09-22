import type { IExecuteFunctions, IDataObject, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation'; // 若你的文件名是 opreations.ts，请改成 '../../../shared/opreations'

const OP = 'auth.token.get';

// 仅在本操作时显示
// const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [];

const op: OperationDef = {
  value: OP,
  name: '认证 获取当前应用的 Access Token',
  description: '直接从凭据（运行期）读取当前 access_token，不发起任何网络请求',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number) {
    const creds = (await this.getCredentials('dingtalkApi')) as {
      accessToken?: string;
      clientId?: string;
      corpId?: string;
    };
    const token = (creds?.accessToken ?? '').trim();
    if (!token)
      throw new NodeOperationError(this.getNode(), '当前凭据没有 access_token', { itemIndex });

    const json: IDataObject = {
      corpId: creds.corpId ?? '',
      clientId: creds.clientId ?? '',
      accessToken: token,
    };
    return { json, pairedItem: { item: itemIndex } };
  },
};

export default op;
