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

const OP = 'workbooks.rows.visibility';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  ...sheetProps(showOnly),
  {
    name: 'row',
    displayName: '要显示或者隐藏的第一行的游标',
    type: 'number',
    default: 0,
    required: true,
    description: '要显示或者隐藏的第一行的游标, 从0开始',
    displayOptions: showOnly,
  },
  {
    name: 'rowCount',
    displayName: '要显示或隐藏的行的数量',
    type: 'number',
    default: 1,
    required: true,
    displayOptions: showOnly,
  },
  {
    name: 'visibility',
    displayName: '可见性',
    type: 'options',
    options: [
      {
        name: '可见',
        value: 'visible',
      },
      {
        name: '隐藏',
        value: 'hidden',
      },
    ],
    default: 'visible',
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '设置行隐藏或显示',
  description: '设置行的可见性',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const sheetId = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const row = this.getNodeParameter('row', itemIndex) as number;
    const rowCount = this.getNodeParameter('rowCount', itemIndex) as number;
    const visibility = this.getNodeParameter('visibility', itemIndex) as string;

    const resp = await request.call(this, {
      method: 'POST',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}/setRowsVisibility`,
      qs: { operatorId },
      body: { row, rowCount, visibility },
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
