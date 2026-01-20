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

const OP = 'workbooks.columns.delete';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  ...sheetProps(showOnly),
  {
    displayName: '要删除的第一列的游标',
    name: 'column',
    type: 'number',
    default: 0,
    required: true,
    description: '要删除的第一列的游标，从0开始',
    displayOptions: showOnly,
  },
  {
    displayName: '要删除的列的数量',
    name: 'columnCount',
    type: 'number',
    default: 1,
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '删除列',
  description: '删除表格中的列',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const sheetId = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const column = this.getNodeParameter('column', itemIndex) as number;
    const columnCount = this.getNodeParameter('columnCount', itemIndex) as number;

    const resp = await request.call(this, {
      method: 'POST',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}/deleteColumns`,
      qs: { operatorId },
      body: { column, columnCount },
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
