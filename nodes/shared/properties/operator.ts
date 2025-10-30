import {
  IDisplayOptions,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeProperties,
} from 'n8n-workflow';

/**
 * 操作人覆盖选项 - boolean 开关
 */
const overrideOperatorProperty: INodeProperties = {
  displayName: '不使用凭证中的操作人',
  name: 'overrideOperator',
  type: 'boolean',
  default: false,
  description: '不使用凭证中的操作人，手动设置操作人unionId',
};

/**
 * 操作人ID字段 - 仅在覆盖选项为true时显示
 */
const operatorIdProperty: INodeProperties = {
  displayName: '操作人的unionId',
  name: 'operatorId',
  type: 'string',
  default: '',
  required: true,
  placeholder: '可通过[用户管理 查询用户详情]获取指定用户的unionId',
  displayOptions: {
    show: {
      overrideOperator: [true],
    },
  },
};

/**
 * 创建带有特定操作显示条件的操作人相关属性
 * @param operation 操作名称，用于 displayOptions
 * @returns 包含两个属性的数组：[overrideOperator, operatorId]
 */
export function operatorProps(displayOptions: IDisplayOptions): INodeProperties[] {
  return [
    {
      ...overrideOperatorProperty,
      displayOptions,
    },
    {
      ...operatorIdProperty,
      displayOptions: {
        ...displayOptions,
        show: {
          ...displayOptions.show,
          overrideOperator: [true],
        },
      },
    },
  ];
}

/**
 * 在 execute 上下文中获取操作人ID
 */
export async function getOperatorId(ctx: IExecuteFunctions, itemIndex: number): Promise<string> {
  // 检查是否要覆盖操作人
  const overrideOperator = ctx.getNodeParameter('overrideOperator', itemIndex, false) as boolean;

  if (overrideOperator) {
    // 如果选择覆盖，使用节点参数中的 operatorId
    const nodeOperatorId = ctx.getNodeParameter('operatorId', itemIndex) as string;
    return nodeOperatorId;
  } else {
    // 否则使用 credentials 中的 userUnionId
    const credentials = await ctx.getCredentials('dingtalkApi');
    return (credentials.userUnionId as string) || '';
  }
}

/**
 * 在 loadOptions 上下文中获取操作人ID
 */
export async function getOperatorIdForLoadOptions(ctx: ILoadOptionsFunctions): Promise<string> {
  // 检查是否要覆盖操作人
  const overrideOperator = ctx.getNodeParameter('overrideOperator', undefined) as boolean;

  if (overrideOperator) {
    // 如果选择覆盖，使用节点参数中的 operatorId
    const nodeOperatorId = ctx.getNodeParameter('operatorId', undefined) as string;
    return nodeOperatorId;
  } else {
    // 否则使用 credentials 中的 userUnionId
    const credentials = await ctx.getCredentials('dingtalkApi');
    return (credentials.userUnionId as string) || '';
  }
}
