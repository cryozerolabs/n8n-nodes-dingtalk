import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';

const OP = 'notable.parseUrl';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: 'AI表格 URL',
    name: 'url',
    type: 'string',
    default: '',
    required: true,
    description: '来自钉钉 AI 表格的分享或地址，例如 https://alidocs.dingtalk.com/i/nodes/...?',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: 'AI表格 解析URL',
  description: '从钉钉 AI 表格 URL 中解析 baseId、sheetId、viewId（例如: alidocs 链接）',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const input = this.getNodeParameter('url', itemIndex) as string;

    let u: URL;
    try {
      u = new URL(input);
    } catch {
      throw new NodeOperationError(this.getNode(), '请输入合法的 URL', { itemIndex });
    }

    // 提取 baseId: 形如 /i/nodes/{baseId}
    const segments = u.pathname.split('/').filter(Boolean);
    const nodesIdx = segments.findIndex((s) => s === 'nodes');
    const baseId = nodesIdx >= 0 && nodesIdx + 1 < segments.length ? segments[nodesIdx + 1] : '';

    // 解析 query：优先从 iframeQuery（URL 编码后的查询串）拿 sheetId/viewId；否则回退到主查询参数
    let sheetId = u.searchParams.get('sheetId') ?? '';
    let viewId = u.searchParams.get('viewId') ?? '';

    const iframeQuery = u.searchParams.get('iframeQuery');
    if (iframeQuery) {
      try {
        const decoded = decodeURIComponent(iframeQuery);
        const inner = new URLSearchParams(decoded);
        sheetId = sheetId || inner.get('sheetId') || '';
        viewId = viewId || inner.get('viewId') || '';
      } catch {
        // 忽略解析失败，保留已有结果
      }
    }

    const out: IDataObject = {
      baseId,
      sheetId,
      viewId,
      sourceUrl: input,
    };

    if (!baseId) {
      throw new NodeOperationError(this.getNode(), 'URL 中未找到 baseId（/i/nodes/{baseId}）', {
        itemIndex,
      });
    }

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
