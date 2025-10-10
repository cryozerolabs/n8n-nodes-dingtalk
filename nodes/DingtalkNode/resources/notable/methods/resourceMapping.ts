import {
  FieldType,
  IDataObject,
  ILoadOptionsFunctions,
  ResourceMapperField,
  ResourceMapperFields,
} from 'n8n-workflow';
import { request } from '../../../../shared/request';
import { getOperatorIdForLoadOptions } from '../../../../shared/properties/operator';

export async function notableGetColumns(
  this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
  const baseId = this.getNodeParameter('baseId', undefined, { extractValue: true }) as string;
  const sheet = this.getNodeParameter('sheetIdOrName', undefined, { extractValue: true }) as string;
  const operatorId = await getOperatorIdForLoadOptions(this);

  const resp = await request.call(this, {
    method: 'GET',
    url: `/notable/bases/${baseId}/sheets/${sheet}/fields`,
    qs: { operatorId },
  });

  const fields: ResourceMapperField[] = [];
  // 遍历resp.value, 每个item都是一个字段
  const value = (resp as IDataObject)?.value;
  if (Array.isArray(value)) {
    for (const field of value) {
      const typeMap = {
        text: 'string',
        number: 'number',
        singleSelect: 'string',
        multipleSelect: 'array',
        date: 'dateTime',
        user: 'object',
        department: 'object',
        attachment: 'object',
        unidirectionalLink: 'object',
        bidirectionalLink: 'object',
        url: 'object',
      } as Record<string, FieldType>;

      fields.push({
        id: field.name,
        displayName: `${field.name} (${field.type})`,
        required: false,
        defaultMatch: false,
        canBeUsedToMatch: true,
        display: true,
        removed: true,
        readOnly: false,
        type: typeMap[field.type] ?? 'string',
      });
    }
  }

  return { fields };
}
