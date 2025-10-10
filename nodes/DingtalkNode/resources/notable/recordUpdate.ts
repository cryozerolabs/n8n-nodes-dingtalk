import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import { baseProps, getBase, getSheet, sheetProps } from './common';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';

const OP = 'notable.record.update';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  {
    displayName: '记录ID',
    name: 'recordId',
    type: 'string',
    default: '',
    required: true,
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
      loadOptionsDependsOn: ['operatorId.value', 'baseId.value', 'sheetIdOrName.value'],
      resourceMapper: {
        resourceMapperMethod: 'notableGetColumns',
        mode: 'add',
        fieldWords: {
          singular: 'column',
          plural: 'columns',
        },
        addAllFields: false,
        multiKeyMatch: true,
      },
    },
  },
];

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...baseProps(showOnly),
  ...sheetProps(showOnly),
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        records: [{ id: 'rec001', fields: { 标题: '新标题' } }],
      },
      null,
      2,
    ),
    jsonDescription:
      '请求体JSON数据。<a href="https://open.dingtalk.com/document/development/api-notable-updaterecords" target="_blank">查看官方API文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '更新记录',
  description: '在数据表中更新多行记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = getBase(this, itemIndex);
    const sheet = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);

    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const dataMode = ctx.getNodeParameter('columns.mappingMode', idx) as string;
        const recordId = ctx.getNodeParameter('recordId', idx) as string;
        const result: IDataObject = {};

        const fields: IDataObject = {};
        if (dataMode === 'defineBelow') {
          const record = ctx.getNodeParameter('columns.value', idx) as IDataObject;
          Object.assign(fields, record);
        } else if (dataMode === 'autoMapInputData') {
          // Auto-map Input Data的情况
          const inputData = ctx.getInputData()[idx];
          const matchingColumns = ctx.getNodeParameter(
            'columns.matchingColumns',
            idx,
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

        result.records = [{ id: recordId, fields }];
        return result;
      },
    });

    const resp = await request.call(this, {
      method: 'PUT',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
