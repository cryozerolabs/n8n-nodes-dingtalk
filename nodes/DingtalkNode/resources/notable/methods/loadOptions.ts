import type { ILoadOptionsFunctions, INodePropertyOptions, IDataObject } from 'n8n-workflow';
import { request } from '../../../../shared/request';

export async function getColumns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const baseId = this.getNodeParameter('base', undefined, { extractValue: true }) as string;
  const sheetId = this.getNodeParameter('sheet', undefined, { extractValue: true }) as string;

  const res = await request.call(this, {
    method: 'GET',
    url: `/notable/bases/${baseId}/sheets/${encodeURIComponent(sheetId)}/fields`,
  });

  const fields = (res as IDataObject).items as IDataObject[];
  return fields.map((f) => ({
    name: String(f.name),
    value: String(f.name), // 若后端以 id 为准，这里也用 id，并在 Mapper 中保持一致
    description: `Type: ${String(f.type)}`,
  }));
}
