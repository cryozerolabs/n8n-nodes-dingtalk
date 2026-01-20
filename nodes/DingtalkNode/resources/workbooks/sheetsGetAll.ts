import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { getWorkbook, workbookProps } from './common';

const OP = 'workbooks.sheets.getAll';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [...operatorProps(showOnly), ...workbookProps(showOnly)];

const op: OperationDef = {
  value: OP,
  name: '获取所有工作表',
  description: '获取指定表格中所有的工作表信息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);

    const resp = await request.call(this, {
      method: 'GET',
      url: `/doc/workbooks/${workbookId}/sheets`,
      qs: { operatorId },
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
