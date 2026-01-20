import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { getSheet, getWorkbook, sheetProps, workbookProps } from './common';

const OP = 'workbooks.ranges.append';
const showOnly = { show: { operation: [OP] } };

/**
 * 将列名转换为索引 (A -> 0, B -> 1, ..., Z -> 25, AA -> 26, ...)
 */
function columnNameToIndex(columnName: string): number {
  let index = 0;
  for (let i = 0; i < columnName.length; i++) {
    index = index * 26 + (columnName.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * 解析范围地址，返回起始列索引和结束列索引
 * 例如: "A1:C1" -> { startCol: 0, endCol: 2, startRow: 1, endRow: 1 }
 */
function parseRangeAddress(range: string): {
  startCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
} {
  const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) {
    throw new Error(`无效的范围地址: ${range}`);
  }
  return {
    startCol: columnNameToIndex(match[1].toUpperCase()),
    startRow: parseInt(match[2], 10),
    endCol: columnNameToIndex(match[3].toUpperCase()),
    endRow: parseInt(match[4], 10),
  };
}

/**
 * 将列索引转换为列名 (0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA, ...)
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

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...workbookProps(showOnly),
  ...sheetProps(showOnly),
  {
    name: 'headerRange',
    displayName: '标题行范围',
    type: 'string',
    default: '',
    placeholder: '例如: A1:C1',
    required: true,
    description: '标题行的范围地址，例如 A1:C1 表示第一行的 A 到 C 列作为标题',
    displayOptions: showOnly,
  },
  {
    displayName: 'Columns',
    name: 'columns',
    type: 'resourceMapper',
    default: {
      mappingMode: 'defineBelow',
      value: null,
    },
    noDataExpression: true,
    required: true,
    displayOptions: showOnly,
    typeOptions: {
      loadOptionsDependsOn: [
        'operatorId.value',
        'workbookId.value',
        'sheetId.value',
        'headerRange',
      ],
      resourceMapper: {
        resourceMapperMethod: 'workbookGetColumns',
        mode: 'add',
        fieldWords: {
          singular: 'column',
          plural: 'columns',
        },
        addAllFields: true,
        multiKeyMatch: false,
        supportAutoMap: false,
      },
    },
  },
];

const op: OperationDef = {
  value: OP,
  name: '插入数据行',
  description: '读取标题行后，在工作表末尾追加一行数据',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const workbookId = getWorkbook(this, itemIndex);
    const sheetId = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const headerRange = this.getNodeParameter('headerRange', itemIndex) as string;

    // 解析标题行范围，获取列信息
    const { startCol, endCol } = parseRangeAddress(headerRange);
    const columnCount = endCol - startCol + 1;

    // Step 1: 获取工作表信息，通过 lastNonEmptyRow 确定最后一行
    const startColName = indexToColumnName(startCol);
    const endColName = indexToColumnName(endCol);

    const sheetResp = await request.call(this, {
      method: 'GET',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}`,
      qs: { operatorId },
    });

    const sheetData = sheetResp as IDataObject;
    // lastNonEmptyRow 从0开始，表为空时返回-1
    const lastNonEmptyRow = (sheetData.lastNonEmptyRow as number) ?? -1;

    // 新数据应该追加到最后一行的下一行
    // lastNonEmptyRow 是0-based，转换为1-based后 +1 得到追加位置
    const appendRow = lastNonEmptyRow + 2;

    // Step 2: 构建请求体
    // 初始化一行空值数组
    const rowValues: (string | null)[] = new Array(columnCount).fill(null);

    // 直接从 resourceMapper 获取用户填写的值
    const record = this.getNodeParameter('columns.value', itemIndex) as IDataObject;

    // 校验：用户必须填写至少一个字段
    if (!record || Object.keys(record).length === 0) {
      throw new NodeOperationError(this.getNode(), '请至少填写一个字段的值', { itemIndex });
    }

    // 按照标题行定义的列范围填充所有列，确保缺失的列补空字符串，而不是被“丢弃”
    for (let i = 0; i < columnCount; i++) {
      const colName = indexToColumnName(startCol + i);
      // 如果用户在 UI 上没填，则置为空字符串 ""，确保数组长度和标题行对齐
      rowValues[i] = record[colName] === undefined ? '' : (record[colName] as string);
    }

    const body = {
      values: [rowValues],
    };

    // Step 3: 调用 ranges update API 写入数据
    const appendRange = `${startColName}${appendRow}:${endColName}${appendRow}`;

    const resp = await request.call(this, {
      method: 'PUT',
      url: `/doc/workbooks/${workbookId}/sheets/${sheetId}/ranges/${appendRange}`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    out.appendedRange = appendRange;
    out.appendedRow = appendRow;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
