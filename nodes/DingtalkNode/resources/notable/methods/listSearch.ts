import {
  type ILoadOptionsFunctions,
  type INodeListSearchResult,
  type INodeListSearchItems,
  type IDataObject,
  NodeOperationError,
} from 'n8n-workflow';
import { request } from '../../../../shared/request';

export async function sheetSearch(
  this: ILoadOptionsFunctions,
  filter?: string,
): Promise<INodeListSearchResult> {
  const operatorId = this.getNodeParameter('operatorId', undefined, {
    extractValue: true,
  }) as string;
  const baseId = this.getNodeParameter('baseId', undefined, { extractValue: true }) as string;

  if (!operatorId || !baseId) {
    // 抛出n8n错误提示
    throw new NodeOperationError(this.getNode(), '请先配置 操作人 和 AI表格');
  }

  this.logger.debug(`sheetSearch baseId: ${baseId}, operatorId: ${operatorId}`);

  const resp = await request.call(this, {
    method: 'GET',
    url: `/notable/bases/${baseId}/sheets`,
    qs: { operatorId },
  });
  this.logger.debug(`sheetSearch resp: ${JSON.stringify(resp)}`);
  const items = (resp as IDataObject).value as IDataObject[];
  this.logger.debug(`sheetSearch items: ${JSON.stringify(items)}`);
  const results: INodeListSearchItems[] = items
    .filter((s) => (filter ? String(s.name).toLowerCase().includes(filter.toLowerCase()) : true))
    .map((s) => ({
      name: String(s.name),
      value: String(s.id),
    }));

  return {
    results,
  };
}
