import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { getSheet, getWorkbook, sheetProps, workbookProps } from './common';

const OP = 'workbooks.rows.insertBefore';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  ...sheetProps(showOnly),
  {
    name: 'row',
    displayName: '指定行的游标',
    type: 'number',
    default: 0,
    required: true,
    description: '指定行的游标, 从0开始',
    displayOptions: showOnly,
  },
  {
    name: 'rowCount',
    displayName: '插入行的数量',
    type: 'number',
    default: 1,
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '指定行上方插入若干行',
  description: '在指定行上方插入若干行',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const sheetId = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const row = this.getNodeParameter('row', itemIndex) as number;
    const rowCount = this.getNodeParameter('rowCount', itemIndex) as number;

    const resp = await request.call(this, {
      method: 'POST',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}/insertRowsBefore`,
      qs: { operatorId },
      body: { row, rowCount },
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
