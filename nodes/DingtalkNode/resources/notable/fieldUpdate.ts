import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { parseJsonBody } from '../../../shared/validation';

const OP = 'notable.field.update';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: 'AI表格ID (baseId)',
    name: 'baseId',
    type: 'string',
    default: '',
    required: true,
    description: '可通过AI表格 解析URL 操作获取',
    displayOptions: showOnly,
  },
  {
    displayName: '数据表ID或名称 (sheetIdOrName)',
    name: 'sheetIdOrName',
    type: 'string',
    default: '',
    required: true,
    description: '可通过AI表格 解析URL 操作获取sheetId',
    displayOptions: showOnly,
  },
  {
    displayName: '字段ID或字段名称 (fieldIdOrName)',
    name: 'fieldIdOrName',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '操作人的 unionId (operatorId)',
    name: 'operatorId',
    type: 'string',
    default: '',
    required: true,
    description: '可通过用户管理 查询用户详情 获取',
    displayOptions: showOnly,
  },
  {
    displayName: '请求体 JSON',
    name: 'body',
    type: 'json',
    default: JSON.stringify({
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
    }),
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
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex) as string;
    const field = this.getNodeParameter('fieldIdOrName', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;
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
