import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { baseRLC, operatorIdRLC, sheetRLC } from './common';

const OP = 'notable.record.get';

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
    displayName: '记录ID (recordId)',
    name: 'recordId',
    type: 'string',
    default: '',
    required: true,
    description: '要查询的记录 ID',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取记录',
  description: '获取AI表格中的一行记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex, '', {
      extractValue: true,
    }) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex, '', {
      extractValue: true,
    }) as string;
    const recordId = this.getNodeParameter('recordId', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex, '', {
      extractValue: true,
    }) as string;

    const resp = await request.call(this, {
      method: 'GET',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records/${recordId}`,
      qs: { operatorId },
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
