import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, parseJsonBody } from '../../../shared/properties/body';
import { baseProps, getBase, getSheet, sheetProps } from './common';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';

const OP = 'notable.record.update';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...baseProps(showOnly),
  ...sheetProps(showOnly),
  ...bodyProps(showOnly, {
    defaultMode: 'fields',
    defaultJsonBody: JSON.stringify(
      {
        records: [{ id: 'rec001', fields: { 标题: '新标题' } }],
      },
      null,
      2,
    ),
  }),
  // {
  //   displayName: '请求体 JSON',
  //   name: 'body',
  //   type: 'json',
  //   default: JSON.stringify(
  //     {
  //       records: [
  //         {
  //           id: 'String',
  //           fields: { 标题: '新标题' },
  //         },
  //       ],
  //     },
  //     null,
  //     2,
  //   ),
  //   required: true,
  //   description:
  //     '官方文档: https://open.dingtalk.com/document/development/api-noatable-updaterecords',
  //   displayOptions: showOnly,
  // },
];

const op: OperationDef = {
  value: OP,
  name: '更新记录',
  description: '在数据表中更新多行记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = getBase(this, itemIndex);
    const sheet = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const raw = this.getNodeParameter('body', itemIndex, {}) as unknown;

    const body = parseJsonBody(raw, this.getNode(), itemIndex);

    const resp = await request.call(this, {
      method: 'PUT',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
