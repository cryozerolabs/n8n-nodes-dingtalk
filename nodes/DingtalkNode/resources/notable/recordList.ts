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

const OP = 'notable.record.getAll';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    ...operatorIdRLC,
    displayOptions: showOnly,
  },
  {
    ...baseRLC,
    displayOptions: showOnly,
  },
  {
    ...sheetRLC,
    displayOptions: showOnly,
  },
  {
    displayName: '请求体 JSON',
    name: 'body',
    type: 'json',
    default: JSON.stringify({
      filter: {
        combination: 'and',
        conditions: [
          {
            field: '标题',
            operator: 'equals',
            value: 'test',
          },
        ],
      },
    }),
    description: '官方文档: https://open.dingtalk.com/document/development/api-notable-listrecords',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '列出多行记录',
  description: '获取AI表格里指定数据表的多行记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex, '', { extractValue: true }) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex, '', {
      extractValue: true,
    }) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex, '', {
      extractValue: true,
    }) as string;
    const raw = this.getNodeParameter('body', itemIndex, {}) as unknown;

    const body = parseJsonBody(raw, this.getNode(), itemIndex);

    const resp = await request.call(this, {
      method: 'POST',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records/list`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
