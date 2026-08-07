import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { baseProps, getBase, getSheet, sheetProps } from './common';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';
import { bodyProps, getBodyData } from '../../../shared/properties/body';

const OP = 'notable.record.insert';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
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

const clientTokenProperty: INodeProperties = {
  displayName: 'Client Token',
  name: 'clientToken',
  // clientToken 是用于幂等控制的 UUID，不是鉴权凭证。
  // eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
  type: 'string',
  default: '',
  placeholder: '550e8400-e29b-41d4-a716-446655440000',
  description: '可选的 UUID v4 幂等键。相同值的重复请求不会重复新增记录；留空时视为新请求',
  displayOptions: showOnly,
};

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...baseProps(showOnly),
  ...sheetProps(showOnly),
  clientTokenProperty,
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        records: [
          {
            fields: {
              字段名: '字段值',
            },
          },
        ],
      },
      null,
      2,
    ),
    jsonDescription:
      '请求体JSON数据。<a href="https://open.dingtalk.com/document/development/api-notable-insertrecords" target="_blank">查看官方API文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '新增记录',
  description: '在AI表格里的指定数据表中新增行记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = getBase(this, itemIndex);
    const sheet = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);
    const clientToken = (this.getNodeParameter('clientToken', itemIndex, '') as string).trim();

    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const result: IDataObject = {};

        const dataMode = ctx.getNodeParameter('columns.mappingMode', idx) as string;
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

        result.records = [{ fields }];
        return result;
      },
    });

    const qs: IDataObject = { operatorId };
    if (clientToken) qs.clientToken = clientToken;

    const resp = await request.call(this, {
      method: 'POST',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records`,
      qs,
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
