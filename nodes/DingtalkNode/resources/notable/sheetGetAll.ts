import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'notable.sheet.getAll';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: 'AI表格ID (baseId)',
    name: 'baseId',
    type: 'string',
    default: '',
    required: true,
    description: 'AI表格ID, 可通过AI表格 解析URL 操作获取',
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
];

const op: OperationDef = {
  value: OP,
  name: '获取所有数据表',
  description: '获取AI表格所有的数据表',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;

    const resp = await request.call(this, {
      method: 'GET',
      url: `/notable/bases/${baseId}/sheets`,
      qs: { operatorId },
      headers: { Accept: 'application/json' },
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
