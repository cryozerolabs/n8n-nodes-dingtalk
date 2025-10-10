import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { parseJsonBody } from '../../../shared/properties/body';
import { baseProps, getBase, getSheet, sheetProps } from './common';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';

const OP = 'notable.field.update';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...baseProps(showOnly),
  ...sheetProps(showOnly),
  {
    displayName: '字段ID或字段名称 (fieldIdOrName)',
    name: 'fieldIdOrName',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '请求体 JSON',
    name: 'body',
    type: 'json',
    default: JSON.stringify(
      {
        name: '字段名',
        property: {
          choices: [
            {
              name: '选项一',
            },
            {
              name: '选项二',
            },
          ],
        },
      },
      null,
      2,
    ),
    required: true,
    description: '官方文档: https://open.dingtalk.com/document/orgapp/api-noatable-updatefield',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '更新字段',
  description: '在数据表中更新一个字段',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = getBase(this, itemIndex);
    const sheet = getSheet(this, itemIndex);
    const field = this.getNodeParameter('fieldIdOrName', itemIndex) as string;
    const operatorId = await getOperatorId(this, itemIndex);
    const raw = this.getNodeParameter('body', itemIndex) as unknown;

    const body = parseJsonBody(raw, this.getNode(), itemIndex);

    const resp = await request.call(this, {
      method: 'PUT',
      url: `/notable/bases/${baseId}/sheets/${sheet}/fields/${field}`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
