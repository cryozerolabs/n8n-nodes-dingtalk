import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { baseRLC, operatorIdRLC, sheetRLC } from './common';

const OP = 'notable.field.getAll';

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
];

const op: OperationDef = {
  value: OP,
  name: '获取所有字段',
  description: '获取在数据表中的所有字段',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;

    const resp = await request.call(this, {
      method: 'GET',
      url: `/notable/bases/${baseId}/sheets/${sheet}/fields`,
      qs: { operatorId },
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
