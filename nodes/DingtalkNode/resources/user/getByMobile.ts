import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'user.getByMobile';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '用户的手机号',
    name: 'mobile',
    type: 'string',
    default: '',
    required: true,
    placeholder: '13000000000',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '根据手机号查询用户',
  description: '根据手机号获取用户的userId',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const mobile = this.getNodeParameter('mobile', itemIndex, '') as string;

    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/user/getbymobile',
      body: {
        mobile,
      },
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return {
      json: out,
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
