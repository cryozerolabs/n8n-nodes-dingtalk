import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'notable.sheet.delete';

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
    displayName: '数据表ID或名称 (sheetIdOrName)',
    name: 'sheetIdOrName',
    type: 'string',
    default: '',
    required: true,
    description: '目标数据表的 ID 或名称',
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
  name: 'AI表格 删除数据表',
  description:
    '在AI表格中删除一个数据表，接口文档：https://open.dingtalk.com/document/development/api-noatable-deletesheet',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;

    const resp = await request.call(this, {
      method: 'DELETE',
      url: `/notable/bases/${baseId}/sheets/${sheet}`,
      qs: { operatorId },
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
