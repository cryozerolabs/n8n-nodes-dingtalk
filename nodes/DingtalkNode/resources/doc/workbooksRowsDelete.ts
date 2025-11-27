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

const OP = 'doc.workbooks.rows.delete';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  ...sheetProps(showOnly),
  {
    name: 'row',
    displayName: '要删除的第一行的游标',
    type: 'number',
    default: 0,
    required: true,
    description: '要删除的第一行的游标, 从0开始',
    displayOptions: showOnly,
  },
  {
    name: 'rowCount',
    displayName: '要删除的行的数量',
    type: 'number',
    default: 1,
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '表格 删除行',
  description: '删除指定的行',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const sheetId = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const row = this.getNodeParameter('row', itemIndex) as number;
    const rowCount = this.getNodeParameter('rowCount', itemIndex) as number;

    const resp = await request.call(this, {
      method: 'POST',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}/deleteRows?operatorId=${operatorId}`,
      body: { row, rowCount },
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
