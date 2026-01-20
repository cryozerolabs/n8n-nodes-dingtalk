import {
  IDataObject,
  ILoadOptionsFunctions,
  NodeOperationError,
  ResourceMapperField,
  ResourceMapperFields,
} from 'n8n-workflow';
import { request } from '../../../../shared/request';
import { getOperatorIdForLoadOptions } from '../../../../shared/properties/operator';

/**
 * 将列索引转换为Excel列名 (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, ...)
 */
function indexToColumnName(index: number): string {
  let columnName = '';
  let num = index;
  while (num >= 0) {
    columnName = String.fromCharCode((num % 26) + 65) + columnName;
    num = Math.floor(num / 26) - 1;
  }
  return columnName;
}

/**
 * 获取工作表列标题，用于 resourceMapper
 * 通过读取用户指定的标题行范围来获取列名
 */
export async function workbookGetColumns(
  this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
  const operatorId = await getOperatorIdForLoadOptions(this);
  const workbookId = this.getNodeParameter('workbookId', undefined, {
    extractValue: true,
  }) as string;
  const sheetId = this.getNodeParameter('sheetId', undefined, {
    extractValue: true,
  }) as string;
  const headerRange = this.getNodeParameter('headerRange', undefined) as string;

  if (!operatorId || !workbookId || !sheetId) {
    throw new NodeOperationError(this.getNode(), '1请先配置 操作人、表格文件 和 工作表');
  }

  if (!headerRange) {
    throw new NodeOperationError(this.getNode(), '请先配置标题行范围，例如 A1:C1');
  }

  // 调用 rangesGet API 获取标题行数据
  const resp = await request.call(this, {
    method: 'GET',
    url: `/doc/workbooks/${workbookId}/sheets/${sheetId}/ranges/${headerRange}`,
    qs: { select: 'values', operatorId },
  });

  const fields: ResourceMapperField[] = [];

  // 解析返回的数据: { values: [["xxx", "xxx", "xxx"]] }
  const respData = resp as IDataObject;
  const values = respData.values as string[][];

  if (Array.isArray(values) && values.length > 0) {
    const headerRow = values[0]; // 第一行就是标题行

    // 解析起始列，从 headerRange 中提取 (例如 "A1:C1" -> "A")
    const startCol = headerRange.match(/^([A-Z]+)/i)?.[1]?.toUpperCase() || 'A';
    const startColIndex = columnNameToIndex(startCol);

    for (let i = 0; i < headerRow.length; i++) {
      const columnName = indexToColumnName(startColIndex + i);
      const headerValue = headerRow[i];
      const displayName = headerValue ? `${headerValue} (${columnName})` : `列 ${columnName}`;

      fields.push({
        id: columnName, // 使用列名作为 ID (A, B, C, ...)
        displayName,
        required: false,
        defaultMatch: false,
        canBeUsedToMatch: true,
        display: true,
        removed: true,
        readOnly: false,
        type: 'string',
      });
    }
  }

  return { fields };
}

/**
 * 将Excel列名转换为索引 (A -> 0, B -> 1, ..., Z -> 25, AA -> 26, ...)
 */
function columnNameToIndex(columnName: string): number {
  let index = 0;
  for (let i = 0; i < columnName.length; i++) {
    index = index * 26 + (columnName.charCodeAt(i) - 64);
  }
  return index - 1;
}
