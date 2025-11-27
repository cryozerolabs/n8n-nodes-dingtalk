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

const OP = 'doc.workbooks.sheetCreate';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  {
    displayName: '工作表的名称',
    name: 'name',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '表格 创建工作表',
  description: '在表格文档中创建一个新的工作表',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const name = this.getNodeParameter('name', itemIndex) as string;
    const operatorId = await getOperatorId(this, itemIndex);

    const resp = await request.call(this, {
      method: 'POST',
      url: `/doc/workbooks/${workbookId}/sheets?operatorId=${operatorId}`,
      body: { name },
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
