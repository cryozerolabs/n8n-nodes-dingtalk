import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { baseRLC, operatorIdRLC, sheetRLC } from './common';

const OP = 'notable.field.delete';

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
    displayName: '字段ID或字段名称 (fieldIdOrName)',
    name: 'fieldIdOrName',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '删除字段',
  description: '在AI表格中删除一个字段',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex) as string;
    const field = this.getNodeParameter('fieldIdOrName', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;

    const resp = await request.call(this, {
      method: 'DELETE',
      url: `/notable/bases/${baseId}/sheets/${sheet}/fields/${field}`,
      qs: { operatorId },
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
