import type {
  ILoadOptionsFunctions,
  INodeListSearchResult,
  INodeListSearchItems,
  IDataObject,
} from 'n8n-workflow';
import { request } from '../../../../shared/request';

export async function sheetSearch(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
  const baseId = this.getNodeParameter('baseId', undefined, { extractValue: true }) as string;
  const operatorId = this.getNodeParameter('operatorId', undefined, {
    extractValue: true,
  }) as string;

  if (!operatorId) {
    // 抛出n8n错误提示
    throw new Error('operatorId is required');
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
  const results: INodeListSearchItems[] = items.map((s) => ({
    name: String(s.name),
    value: String(s.id),
  }));

  //   if (paginationToken) qs.cursor = paginationToken;

  //   const resp = await request.call(this, {
  //     method: 'GET',
  //     url: `/notable/bases/${baseId}/sheets`,
  //     qs: { operatorId },
  //   });

  //   const items = (resp as IDataObject).items as IDataObject[];
  //   const results: INodeListSearchItems[] = items
  //     .filter((s) => (filter ? String(s.name).toLowerCase().includes(filter.toLowerCase()) : true))
  //     .map((s) => ({
  //       name: String(s.name),
  //       value: String(s.id),
  //       url: `https://notable.example.com/base/${baseId}/sheet/${String(s.id)}`,
  //     }));

  return {
    results,
  };

  //   return { results, paginationToken: (resp as IDataObject).nextCursor as string | undefined };
}
