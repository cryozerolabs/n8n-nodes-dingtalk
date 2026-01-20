import {
  type ILoadOptionsFunctions,
  type INodeListSearchResult,
  type INodeListSearchItems,
  type IDataObject,
  NodeOperationError,
} from 'n8n-workflow';
import { request } from '../../../../shared/request';
import { getOperatorIdForLoadOptions } from '../../../../shared/properties/operator';
export async function workbookSheetsSearch(
  this: ILoadOptionsFunctions,
  filter?: string,
): Promise<INodeListSearchResult> {
  const operatorId = await getOperatorIdForLoadOptions(this);
  const workbookId = this.getNodeParameter('workbookId', undefined, {
    extractValue: true,
  }) as string;

  if (!operatorId || !workbookId) {
    // 抛出n8n错误提示
    throw new NodeOperationError(this.getNode(), '请先配置 操作人 和表格文件');
  }

  const resp = await request.call(this, {
    method: 'GET',
    url: `/doc/workbooks/${workbookId}/sheets?operatorId=${operatorId}`,
    qs: { operatorId },
  });
  const items = (resp as IDataObject).value as IDataObject[];
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
