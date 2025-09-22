import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'notable.sheet.create';

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
    default: `{"name":"新建数据表"}`,
    required: true,
    description:
      '创建数据表的请求体，具体字段可参考官方文档：https://open.dingtalk.com/document/development/api-createsheet#h2-zdy-imz-xv4',
    displayOptions: showOnly,
  },
];

interface NotableSheetField {
  name: string;
  type: string;
  property?: Record<string, unknown>;
}

interface NotableSheetCreateBody {
  name?: string;
  fields?: NotableSheetField[];
}

const op: OperationDef = {
  value: OP,
  name: 'AI表格 新建数据表',
  description: '在 AI 表格中新建一个数据表',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;
    const raw = this.getNodeParameter('data', itemIndex) as unknown;

    // 允许 data 是字符串或对象；统一解析并校验为对象
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

    const typed = body as Partial<NotableSheetCreateBody>;
    if (typeof typed.name !== 'string' || typed.name.trim() === '') {
      throw new NodeOperationError(this.getNode(), 'name 必须为非空字符串', { itemIndex });
    }
    if (typed.fields !== undefined) {
      if (!Array.isArray(typed.fields)) {
        throw new NodeOperationError(this.getNode(), 'fields 必须为数组', { itemIndex });
      }
      for (const f of typed.fields) {
        if (!f || typeof f !== 'object') {
          throw new NodeOperationError(this.getNode(), 'fields 项必须为对象', { itemIndex });
        }
        if (typeof f.name !== 'string' || f.name.trim() === '') {
          throw new NodeOperationError(this.getNode(), '每个字段需包含 name（字符串）', {
            itemIndex,
          });
        }
        if (typeof f.type !== 'string' || f.type.trim() === '') {
          throw new NodeOperationError(this.getNode(), '每个字段需包含 type（字符串）', {
            itemIndex,
          });
        }
        if (f.property !== undefined && (typeof f.property !== 'object' || f.property === null)) {
          throw new NodeOperationError(this.getNode(), 'field.property 必须为对象', {
            itemIndex,
          });
        }
      }
    }

    const resp = await request.call(this, {
      method: 'POST',
      url: `/notable/bases/${baseId}/sheets`,
      qs: { operatorId },
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: typed as NotableSheetCreateBody,
      json: true,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
