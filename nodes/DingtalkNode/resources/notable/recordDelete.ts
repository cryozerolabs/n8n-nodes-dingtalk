import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';
import {
  commaSeparatedStringProperty,
  getCommaSeparatedValues,
} from '../../../shared/properties/commaSeparatedString';
import { baseProps, getBase, getSheet, sheetProps } from './common';

const OP = 'notable.record.delete';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

// 定义表单模式下的属性
const formProperties: INodeProperties[] = [
  commaSeparatedStringProperty({
    displayName: '记录ID列表',
    name: 'recordIds',
    required: true,
    placeholder: '例如：rec001, rec002',
    description: '要删除的记录ID列表，多个参数请用","分隔。支持表达式和固定值',
  }),
];

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...baseProps(showOnly),
  ...sheetProps(showOnly),
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        recordIds: ['rec001', 'rec002'],
      },
      null,
      2,
    ),
    jsonDescription:
      '请求体JSON数据。<a href="https://open.dingtalk.com/document/development/api-noatable-deleterecords" target="_blank">查看API文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '删除多行记录',
  description: '删除数据表中的多行记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = getBase(this, itemIndex);
    const sheet = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);

    // 使用新的getBodyData方法获取请求体
    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const recordIds = getCommaSeparatedValues(ctx, idx, 'recordIds');

        return {
          recordIds,
        };
      },
    });

    const resp = await request.call(this, {
      method: 'POST',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records/delete`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
