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

const OP = 'workbooks.ranges.get';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  ...sheetProps(showOnly),
  {
    displayName: 'Range地址',
    name: 'rangeAddress',
    type: 'string',
    default: '',
    placeholder: '例如: A3:C3',
    required: true,
    description: '要获取的单元格范围, 格式为 区域内左上角单元格:区域内右下角单元格, 例如：B2:C3',
    displayOptions: showOnly,
  },
  {
    displayName: '筛选要返回的字段',
    name: 'select',
    type: 'string',
    default: 'values',
    placeholder: '例如: values,formulas',
    description:
      '筛选要返回的字段，该参数不传则返回所有字段。如values，该接口只返回values字段。返回多个字段时，使用逗号分隔，例如values,formulas，该接口只返回values和formulas字段。',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取单元格区域',
  description: '获取单元格属性',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const sheetId = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const rangeAddress = this.getNodeParameter('rangeAddress', itemIndex) as string;
    const select = this.getNodeParameter('select', itemIndex) as string;

    const resp = await request.call(this, {
      method: 'GET',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}/ranges/${rangeAddress}`,
      qs: { select, operatorId },
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
