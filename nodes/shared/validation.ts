import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/**
 * 统一解析 JSON body 参数
 * @param raw - 原始参数值（可能是字符串或对象）
 * @param node - n8n 节点实例
 * @param itemIndex - 当前处理的数据项索引
 * @returns 解析后的对象
 */
export function parseJsonBody(
  raw: unknown,
  node: INode,
  itemIndex: number,
): Record<string, unknown> {
  let body: unknown = raw;
  if (typeof raw === 'string') {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new NodeOperationError(node, '请求体 JSON 不是合法的 JSON 字符串', { itemIndex });
    }
  }
  if (typeof body !== 'object' || body === null) {
    throw new NodeOperationError(node, '请求体必须为 JSON 对象', { itemIndex });
  }
  return body as Record<string, unknown>;
}
