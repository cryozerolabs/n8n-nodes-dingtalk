import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation'; // ← 若你的文件叫 opreations.ts，请改成 '../../../shared/opreations'
import { request } from '../../../shared/request';

const OP = 'notable.record.add';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: 'AI表格ID (baseId)',
    name: 'baseId',
    type: 'string',
    default: '',
    required: true,
    description:
      'AI表格ID，获取方式请参考文档：https://open.dingtalk.com/document/orgapp/notable-data-structure',
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
    default: `{"records":[{"fields":{"标题":"测试1"}}]}`,
    required: true,
    description: '形如：{"records":[{"fields":{"字段名":"值"}}]}',
    displayOptions: showOnly,
  },
];

interface NotableRecordAddBody {
  records: Array<{ fields: Record<string, unknown> }>;
}

const op: OperationDef = {
  value: OP,
  name: 'AI表格 新增记录',
  description: '向指定 AI 表格的数据表新增记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex) as string;
    const raw = this.getNodeParameter('data', itemIndex) as unknown;

    // 允许 data 是字符串或对象；统一解析并校验
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
    // 基础结构校验
    if (
      typeof body !== 'object' ||
      body === null ||
      !Array.isArray((body as { records?: unknown }).records)
    ) {
      throw new NodeOperationError(
        this.getNode(),
        '请求体缺少必填字段：records（数组），每项需包含 fields 对象',
        { itemIndex },
      );
    }

    // 发送请求（自动处理 token 注入与过期重试）
    const resp = await request.call(this, {
      method: 'POST',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records`,
      qs: { operatorId },
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body as NotableRecordAddBody,
      json: true,
    });

    // 返回给下游；收敛成 IDataObject
    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
