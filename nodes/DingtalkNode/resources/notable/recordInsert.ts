import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { baseRLC, operatorIdRLC, sheetRLC } from './common';

const OP = 'notable.record.insert';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  { ...operatorIdRLC, displayOptions: showOnly },
  { ...baseRLC, displayOptions: showOnly },
  { ...sheetRLC, displayOptions: showOnly },
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
      loadOptionsDependsOn: ['operatorId.value', 'baseId.value', 'sheetIdOrName.value'],
      resourceMapper: {
        resourceMapperMethod: 'notableGetColumns',
        mode: 'add',
        fieldWords: {
          singular: 'column',
          plural: 'columns',
        },
        addAllFields: true,
        multiKeyMatch: true,
      },
    },
  },
  // {
  //   displayName: '请求体 JSON',
  //   name: 'body',
  //   type: 'json',
  //   default: JSON.stringify({
  //     records: [
  //       {
  //         fields: {
  //           字段名: '字段值',
  //         },
  //       },
  //     ],
  //   }),
  //   required: true,
  //   description:
  //     '官方文档: https://open.dingtalk.com/document/development/api-notable-insertrecords',
  //   displayOptions: showOnly,
  // },
];

const op: OperationDef = {
  value: OP,
  name: '新增记录',
  description: '在AI表格里的指定数据表中新增行记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = this.getNodeParameter('baseId', itemIndex, '', { extractValue: true }) as string;
    const sheet = this.getNodeParameter('sheetIdOrName', itemIndex, '', {
      extractValue: true,
    }) as string;
    const operatorId = this.getNodeParameter('operatorId', itemIndex, '', {
      extractValue: true,
    }) as string;

    const dataMode = this.getNodeParameter('columns.mappingMode', itemIndex) as string;

    // 处理发送的数据
    const fields: IDataObject = {};
    if (dataMode === 'defineBelow') {
      // Map Each Column Manually的情况
      const record = this.getNodeParameter('columns.value', itemIndex) as IDataObject;
      // 直接将 record 中的字段复制到 fields
      Object.assign(fields, record);
    } else if (dataMode === 'autoMapInputData') {
      // Auto-map Input Data的情况
      const inputData = this.getInputData()[itemIndex];
      const matchingColumns = this.getNodeParameter(
        'columns.matchingColumns',
        itemIndex,
        [],
      ) as string[];

      // 如果有匹配列且输入数据存在，则进行字段映射
      if (matchingColumns.length > 0 && inputData?.json) {
        const inputJson = inputData.json as IDataObject;

        // 只遍历匹配的字段
        for (const fieldId of matchingColumns) {
          if (fieldId in inputJson) {
            fields[fieldId] = inputJson[fieldId];
          }
        }
      }
    }

    const resp = await request.call(this, {
      method: 'POST',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records`,
      qs: { operatorId },
      body: {
        records: [{ fields }],
      },
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
