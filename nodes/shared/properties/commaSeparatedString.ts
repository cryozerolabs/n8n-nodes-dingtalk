import type { IExecuteFunctions, INodeProperties } from 'n8n-workflow';

/**
 * 创建一个支持逗号分隔输入的字符串参数
 */
export function commaSeparatedStringProperty(
  overrides: Partial<INodeProperties> = {},
): INodeProperties {
  const property: INodeProperties = {
    displayName: '值列表',
    name: 'values',
    type: 'string',
    placeholder: '例如：value1, value2',
    description: '多个参数请用","分隔',
    hint: '多个参数请用","分隔',
    default: '',
    ...overrides,
  };

  property.default = typeof overrides.default === 'undefined' ? '' : overrides.default;

  return property;
}

/**
 * 在 execute 上下文中获取逗号分隔的参数值
 */
export function getCommaSeparatedValues(
  ctx: IExecuteFunctions,
  itemIndex: number,
  parameterName: string,
): string[] {
  const raw = ctx.getNodeParameter(parameterName, itemIndex) as string;
  return raw
    .trim()
    .split(/[\n,，]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
