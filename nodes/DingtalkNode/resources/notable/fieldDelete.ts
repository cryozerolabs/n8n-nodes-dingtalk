import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { baseProps, getBase, getSheet, sheetProps } from './common';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';

const OP = 'notable.field.delete';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...baseProps(showOnly),
  ...sheetProps(showOnly),
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
    const baseId = getBase(this, itemIndex);
    const sheet = getSheet(this, itemIndex);
    const field = this.getNodeParameter('fieldIdOrName', itemIndex) as string;
    const operatorId = await getOperatorId(this, itemIndex);

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
