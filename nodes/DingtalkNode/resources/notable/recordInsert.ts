import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { parseJsonBody } from '../../../shared/validation';
import { baseRLC, operatorIdRLC, sheetRLC } from './common';

const OP = 'notable.record.insert';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  { ...operatorIdRLC, displayOptions: showOnly },
  { ...baseRLC, displayOptions: showOnly },
  { ...sheetRLC, displayOptions: showOnly },
  {
    displayName: '请求体 JSON',
    name: 'body',
    type: 'json',
    default: JSON.stringify({
      records: [
        {
          fields: {
            字段名: '字段值',
          },
        },
      ],
    }),
    required: true,
    description:
      '官方文档: https://open.dingtalk.com/document/development/api-notable-insertrecords',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '新增记录',
  description: '在AI表格里的指定数据表中新增行记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;
    const raw = this.getNodeParameter('body', itemIndex) as unknown;

    const body = parseJsonBody(raw, this.getNode(), itemIndex);

    const resp = await request.call(this, {
      method: 'POST',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
