import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'user.get';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: 'User ID',
    name: 'userId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
];

interface UserGetResp {
  errcode?: number;
  errmsg?: string;
  result?: { unionid?: string; userid?: string; [k: string]: unknown };
  [k: string]: unknown;
}

const op: OperationDef = {
  value: OP,
  name: '查询用户详情',
  description: '调用本接口获取指定用户的详细信息。',
  properties,

  // 显式标注 this 和返回类型
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const userid = this.getNodeParameter('userId', itemIndex) as string;

    // 带 this 绑定的函数用 .call(this, ...)；泛型用 as 断言收回类型
    const resp = (await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/user/get',
      body: { userid },
    })) as UserGetResp;

    const out: IDataObject = (resp.result ?? resp) as unknown as IDataObject;

    return {
      json: out,
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
