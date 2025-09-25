import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { parseJsonBody } from '../../../shared/validation';
import { baseRLC, operatorIdRLC, sheetRLC } from './common';

const OP = 'notable.sheet.update';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    ...operatorIdRLC,
    displayOptions: showOnly,
  },
  {
    ...baseRLC,
    displayOptions: showOnly,
  },
  {
    ...sheetRLC,
    displayOptions: showOnly,
  },
  {
    displayName: '请求体 JSON',
    name: 'body',
    type: 'json',
    default: JSON.stringify({
      name: '重命名后的数据表',
    }),
    required: true,
    description:
      '官方文档: https://open.dingtalk.com/document/development/api-noatable-updatesheet',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '更新数据表',
  description: '更新一个数据表的信息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;
    const raw = this.getNodeParameter('body', itemIndex) as unknown;

    const body = parseJsonBody(raw, this.getNode(), itemIndex);

    const resp = await request.call(this, {
      method: 'PUT',
      url: `/notable/bases/${baseId}/sheets/${sheet}`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
