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

const OP = 'notable.record.getAll';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

// 定义字段模式下的属性
const formProperties: INodeProperties[] = [
  {
    displayName: '筛选条件',
    name: 'filter',
    placeholder: '添加筛选条件',
    type: 'fixedCollection',
    typeOptions: {
      multipleValueButtonText: '添加筛选条件',
      multipleValues: true,
      sortable: true,
    },
    default: {},
    options: [
      {
        displayName: '筛选条件',
        name: 'conditions',
        values: [
          {
            displayName: '字段',
            name: 'field',
            type: 'options',
            typeOptions: {
              loadOptionsDependsOn: ['operatorId.value', 'baseId.value', 'sheetIdOrName.value'],
              loadOptionsMethod: 'notableGetFieldsAndAddOptions',
            },
            default: '',
            description:
              '配置操作人、AI表格和数据表参数后，可从列表中选择最新支持的字段，或使用expression指定字段名称或ID',
          },
          {
            displayName: '条件类型',
            name: 'operator',
            type: 'options',
            options: [
              {
                name: '等于',
                value: 'equal',
              },
              {
                name: '不等于',
                value: 'notEqual',
              },
              {
                name: '包含',
                value: 'contain',
              },
              {
                name: '不包含',
                value: 'notContain',
              },
              {
                name: '为空',
                value: 'empty',
              },
              {
                name: '不为空',
                value: 'notEmpty',
              },
              {
                name: '大于',
                value: 'greater',
              },
              {
                name: '大于等于',
                value: 'greaterEqual',
              },
              {
                name: '小于',
                value: 'less',
              },
              {
                name: '小于等于',
                value: 'lessEqual',
              },
            ],
            default: 'equal',
          },
          {
            displayName: '条件值',
            name: 'value',
            type: 'string',
            default: '',
            placeholder: '输入条件值',
            description: '输入要比较的值',
            displayOptions: {
              show: {
                operator: ['equal', 'notEqual', 'greater', 'greaterEqual', 'less', 'lessEqual'],
              },
            },
          },
          {
            displayName: '条件值',
            name: 'value',
            type: 'string',
            placeholder: '例如：value1, value2',
            description: '多个参数请用","分隔',
            hint: '多个参数请用","分隔',
            default: '',
            displayOptions: {
              show: {
                operator: ['contain', 'notContain'],
              },
            },
          },
        ],
      },
    ],
  },
  {
    displayName: '筛选条件组合方式',
    name: 'combination',
    type: 'options',
    default: 'and',
    options: [
      { name: 'AND', value: 'and', description: '同时满足所有条件' },
      { name: 'OR', value: 'or', description: '满足任一条件' },
    ],
  },
  {
    displayName: '每页获取的数据量',
    name: 'maxResults',
    type: 'number',
    default: 100,
    placeholder: '100',
    description: '每页获取的数据量，默认值为100，最小值为1，最大值为100。',
  },
  {
    displayName: '上一次查询返回的游标',
    name: 'nextToken',
    // eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
    type: 'string',
    default: '',
    placeholder: '上一次查询返回的游标，首次查询时不需要传',
    description: '上一次查询返回的游标，首次查询时不需要传',
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
        filter: {
          combination: 'and',
          conditions: [
            {
              field: '标题',
              operator: 'equal',
              value: ['test'],
            },
            {
              field: '标签',
              operator: 'contain',
              value: ['重要', '紧急'],
            },
          ],
        },
      },
      null,
      2,
    ),
    jsonDescription:
      '请求体JSON。<a href="https://open.dingtalk.com/document/development/api-notable-listrecords" target="_blank">查看官方API文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '列出多行记录',
  description: '获取AI表格里指定数据表的多行记录',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const baseId = getBase(this, itemIndex);
    const sheet = getSheet(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);

    // 使用新的getBodyData方法获取请求体
    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const result: IDataObject = {};

        // 构建筛选条件
        const filter = ctx.getNodeParameter('filter', idx, {}) as IDataObject;
        const combination = ctx.getNodeParameter('combination', idx, 'and') as string;

        if (filter.conditions && Array.isArray(filter.conditions)) {
          result.filter = {
            combination,
            conditions: filter.conditions.map((cond) => {
              const { operator } = cond;
              let value;

              // 根据条件类型处理不同的值格式
              if (operator === 'empty' || operator === 'notEmpty') {
                // 对于空/非空类型，不需要值
                value = '';
              } else {
                // 对于内容包含/不包含类型，使用','分隔的值列表
                value = cond.value
                  .trim()
                  .split(/[\n,，]/)
                  .map((v: string) => v.trim())
                  .filter((v: string) => v.length > 0);
              }

              return {
                field: cond.field,
                operator: cond.operator,
                value,
              };
            }),
          };
        }

        // 添加分页参数
        const maxResults = ctx.getNodeParameter('maxResults', idx, 100) as number;
        const nextToken = ctx.getNodeParameter('nextToken', idx, '') as string;

        if (maxResults) {
          result.maxResults = maxResults;
        }
        if (nextToken) {
          result.nextToken = nextToken;
        }

        return result;
      },
    });

    const resp = await request.call(this, {
      method: 'POST',
      url: `/notable/bases/${baseId}/sheets/${sheet}/records/list`,
      qs: { operatorId },
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
