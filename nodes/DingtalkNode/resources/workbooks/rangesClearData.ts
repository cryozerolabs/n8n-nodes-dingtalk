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

const OP = 'workbooks.ranges.clearData';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  ...sheetProps(showOnly),
  {
    name: 'rangeAddress',
    displayName: '需要清除的单元格范围',
    type: 'string',
    default: '',
    placeholder: '例如: B2:C3',
    required: true,
    description: '需要清除的单元格范围，格式为 区域内左上角单元格:区域内右下角单元格, 例如：B2:C3',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '清除单元格区域内数据',
  description: '清除单元格内的数据，不包括格式',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const sheetId = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const rangeAddress = this.getNodeParameter('rangeAddress', itemIndex) as string;

    const resp = await request.call(this, {
      method: 'POST',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}/ranges/${rangeAddress}/clearData`,
      qs: { operatorId },
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
