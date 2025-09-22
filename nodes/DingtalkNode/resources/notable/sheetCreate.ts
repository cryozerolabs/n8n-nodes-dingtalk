import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { parseJsonBody } from '../../../shared/validation';

const OP = 'notable.sheet.create';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: 'AI表格ID (baseId)',
    name: 'baseId',
    type: 'string',
    default: '',
    required: true,
    description: '可通过AI表格 解析URL 操作获取',
    displayOptions: showOnly,
  },
  {
    displayName: '操作人的 unionId (operatorId)',
    name: 'operatorId',
    type: 'string',
    default: '',
    required: true,
    description: '可通过用户管理 查询用户详情 获取',
    displayOptions: showOnly,
  },
  {
    displayName: '请求体 JSON',
    name: 'body',
    type: 'json',
    default: JSON.stringify({
      name: '新建数据表',
    }),
    required: true,
    description: '官方文档: https://open.dingtalk.com/document/development/api-createsheet',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '新建数据表',
  description: '在AI表格中创建一个新的数据表',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;
    const raw = this.getNodeParameter('body', itemIndex) as unknown;

    const body = parseJsonBody(raw, this.getNode(), itemIndex);

    const resp = await request.call(this, {
      method: 'POST',
      url: `/notable/bases/${baseId}/sheets`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
