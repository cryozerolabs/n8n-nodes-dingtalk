import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { baseProps, getBase, getSheet, sheetProps } from './common';
import { operatorProps, getOperatorId } from '../../../shared/properties/operator';

const OP = 'notable.field.getAll';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...baseProps(showOnly),
  ...sheetProps(showOnly),
];

const op: OperationDef = {
  value: OP,
  name: '获取所有字段',
  description: '获取在数据表中的所有字段',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = getBase(this, itemIndex);
    const sheet = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);

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
