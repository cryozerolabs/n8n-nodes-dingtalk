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

const OP = 'doc.workbooks.sheetDelete';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  ...sheetProps(showOnly),
];

const op: OperationDef = {
  value: OP,
  name: '表格 删除工作表',
  description: '删除表格内的某个工作表',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const sheetId = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);

    const resp = await request.call(this, {
      method: 'DELETE',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}?operatorId=${operatorId}`,
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
