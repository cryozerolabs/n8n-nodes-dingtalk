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

const OP = 'workbooks.range.update';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  ...sheetProps(showOnly),
  {
    name: 'rangeAddress',
    displayName: 'Range地址',
    type: 'string',
    default: '',
    placeholder: '例如: B2:C3',
    required: true,
    description: '需要更新的单元格范围，格式为 区域内左上角单元格:区域内右下角单元格, 例如：B2:C3',
    displayOptions: showOnly,
  },
  {
    name: 'jsonBody',
    displayName: '请求体JSON',
    type: 'json',
    default: JSON.stringify(
      {
        values: [
          ['B2', 'C2'],
          ['B3', 'C3'],
        ],
      },
      null,
      2,
    ),
    required: true,
    description:
      '请求体JSON数据。<a href="https://open.dingtalk.com/document/development/update-cell-properties" target="_blank">查看官方API文档</a>',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '更新单元格区域',
  description: '更新单元格信息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const sheetId = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const rangeAddress = this.getNodeParameter('rangeAddress', itemIndex) as string;
    const body = this.getNodeParameter('jsonBody', itemIndex) as string;

    const resp = await request.call(this, {
      method: 'PUT',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}/ranges/${rangeAddress}`,
      qs: { operatorId },
      body,
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
