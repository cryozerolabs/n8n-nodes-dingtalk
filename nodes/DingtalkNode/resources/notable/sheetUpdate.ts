import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'notable.sheet.update';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: 'AI表格ID (baseId)',
    name: 'baseId',
    type: 'string',
    default: '',
    required: true,
    description: 'AI表格ID, 可通过AI表格 解析URL 操作获取',
    displayOptions: showOnly,
  },
  {
    displayName: '数据表ID或名称 (sheetIdOrName)',
    name: 'sheetIdOrName',
    type: 'string',
    default: '',
    required: true,
    description: '目标数据表的 ID 或名称',
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
    name: 'data',
    type: 'json',
    default: `{"name":"重命名后的数据表"}`,
    required: true,
    description: '更新数据表的请求体，具体字段可参考官方文档',
    displayOptions: showOnly,
  },
];

interface NotableSheetUpdateBody {
  name?: string;
}

const op: OperationDef = {
  value: OP,
  name: 'AI表格 更新数据表',
  description: '更新 AI 表格中的数据表',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;
    const raw = this.getNodeParameter('data', itemIndex) as unknown;

    let body: unknown = raw;
    if (typeof raw === 'string') {
      try {
        body = JSON.parse(raw);
      } catch {
        throw new NodeOperationError(this.getNode(), '请求体 JSON 不是合法的 JSON 字符串', {
          itemIndex,
        });
      }
    }
    if (typeof body !== 'object' || body === null) {
      throw new NodeOperationError(this.getNode(), '请求体必须为 JSON 对象', { itemIndex });
    }

    const typed = body as Partial<NotableSheetUpdateBody>;
    if (typeof typed.name !== 'string' || typed.name.trim() === '') {
      throw new NodeOperationError(this.getNode(), 'name 必须为非空字符串', { itemIndex });
    }

    const resp = await request.call(this, {
      method: 'PUT',
      url: `/notable/bases/${baseId}/sheets/${sheet}`,
      qs: { operatorId },
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: typed as NotableSheetUpdateBody,
      json: true,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
