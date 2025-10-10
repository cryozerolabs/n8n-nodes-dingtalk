import {
  IDisplayOptions,
  IExecuteFunctions,
  INodeProperties,
  IDataObject,
  INode,
  NodeOperationError,
} from 'n8n-workflow';

/**
 * 统一解析 JSON body 参数
 * @param raw - 原始参数值（可能是字符串或对象）
 * @param node - n8n 节点实例
 * @param itemIndex - 当前处理的数据项索引
 * @returns 解析后的对象
 */
export function parseJsonBody(
  raw: unknown,
  node: INode,
  itemIndex: number,
): Record<string, unknown> {
  let body: unknown = raw;
  if (typeof raw === 'string') {
    try {
      body = JSON.parse(raw);
    } catch {
      throw new NodeOperationError(node, '请求体 JSON 不是合法的 JSON 字符串', { itemIndex });
    }
  }
  if (typeof body !== 'object' || body === null) {
    throw new NodeOperationError(node, '请求体必须为 JSON 对象', { itemIndex });
  }
  return body as Record<string, unknown>;
}

/**
 * 发送Body的方式选项
 */
const sendBodyModeProperty: INodeProperties = {
  displayName: '发送请求体',
  name: 'sendBody',
  type: 'options',
  options: [
    {
      name: '使用下面定义的表单',
      value: 'fields',
    },
    {
      name: '使用JSON',
      value: 'json',
    },
  ],
  default: 'fields',
  description: '如何发送请求体数据',
};

/**
 * JSON Body 输入框
 */
const jsonBodyProperty: INodeProperties = {
  displayName: '请求体JSON',
  name: 'jsonBody',
  type: 'json',
  default: '{}',
  description: '请求体JSON数据',
  displayOptions: {
    show: {
      sendBody: ['json'],
    },
  },
};

/**
 * 创建带有特定显示条件的Body相关属性
 * @param displayOptions 显示条件
 * @param defaultJsonBody 默认的JSON body内容
 * @param jsonDescription JSON模式的描述
 * @param fieldsProperties 字段模式下的属性数组
 * @returns 包含Body相关属性的数组
 */
export function bodyProps(
  displayOptions: IDisplayOptions,
  options: {
    defaultJsonBody?: string;
    jsonDescription?: string;
    fieldsProperties?: INodeProperties[];
    defaultMode?: 'fields' | 'json';
    showModeSelector?: boolean;
  } = {},
): INodeProperties[] {
  const {
    defaultJsonBody = '{}',
    jsonDescription = '请求体JSON数据',
    fieldsProperties = [],
    defaultMode = 'fields',
    showModeSelector = true,
  } = options;

  const properties: INodeProperties[] = [];

  // 只有在需要显示模式选择器时才添加
  if (showModeSelector) {
    properties.push({
      ...sendBodyModeProperty,
      default: defaultMode,
      displayOptions,
    });
  }

  // JSON模式的属性
  const jsonDisplayOptions = showModeSelector
    ? {
        ...displayOptions,
        show: {
          ...displayOptions.show,
          sendBody: ['json'],
        },
      }
    : displayOptions;

  properties.push({
    ...jsonBodyProperty,
    default: defaultJsonBody,
    description: jsonDescription,
    displayOptions: jsonDisplayOptions,
  });

  // 字段模式的属性
  if (fieldsProperties.length > 0) {
    const fieldsDisplayOptions = showModeSelector
      ? {
          ...displayOptions,
          show: {
            ...displayOptions.show,
            sendBody: ['fields'],
          },
        }
      : displayOptions;

    fieldsProperties.forEach((prop) => {
      properties.push({
        ...prop,
        displayOptions: {
          ...prop.displayOptions,
          ...fieldsDisplayOptions,
          show: {
            ...fieldsDisplayOptions.show,
            ...prop.displayOptions?.show,
          },
        },
      });
    });
  }

  return properties;
}

/**
 * 在execute上下文中获取Body数据
 * @param ctx 执行上下文
 * @param itemIndex 数据项索引
 * @param options 配置选项
 * @returns 解析后的body对象
 */
export function getBodyData(
  ctx: IExecuteFunctions,
  itemIndex: number,
  options: {
    showModeSelector?: boolean;
    defaultMode?: 'fields' | 'json';
    fieldsBuilder?: (ctx: IExecuteFunctions, itemIndex: number) => IDataObject;
  } = {},
): IDataObject {
  const { showModeSelector = true, defaultMode = 'fields', fieldsBuilder } = options;

  let sendBodyMode: string;

  if (showModeSelector) {
    sendBodyMode = ctx.getNodeParameter('sendBody', itemIndex, defaultMode) as string;
  } else {
    sendBodyMode = defaultMode;
  }

  if (sendBodyMode === 'json') {
    // JSON模式：直接使用用户提供的JSON
    const raw = ctx.getNodeParameter('jsonBody', itemIndex, {}) as unknown;
    return parseJsonBody(raw, ctx.getNode(), itemIndex) as IDataObject;
  } else {
    // 字段模式：使用fieldsBuilder构建body
    if (fieldsBuilder) {
      return fieldsBuilder(ctx, itemIndex);
    }
    return {};
  }
}
