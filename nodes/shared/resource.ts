import type { INodeProperties, INodeType } from 'n8n-workflow';
import type { OperationDef } from './operation';

export type MethodsBundle = Partial<NonNullable<INodeType['methods']>>;

export interface ResourceBundle {
  value: string; // 资源值，如 'notable' / 'user'
  name: string; // 资源显示名
  operations: OperationDef[]; // 本资源下的全部操作
  operationProperty: INodeProperties; // 本资源的 Operation 下拉（带 show.resource）
  properties: INodeProperties[]; // 聚合后的参数（补了 show.resource）
  methods?: MethodsBundle;
}

/** 给参数补上 displayOptions.show.resource = [resource]，不覆盖原 operation 过滤 */
function attachResourceShow(props: INodeProperties[], resource: string): INodeProperties[] {
  return props.map((p) => {
    const existed = p.displayOptions?.show ?? {};
    const existedRes = (existed as Record<string, unknown>).resource as string[] | undefined;
    const nextRes = Array.isArray(existedRes)
      ? Array.from(new Set([...existedRes, resource]))
      : [resource];

    return {
      ...p,
      displayOptions: {
        ...(p.displayOptions ?? {}),
        show: { ...existed, resource: nextRes },
      },
    };
  });
}

/** 验证和处理操作定义列表 */
function processOperations(operations: OperationDef[]): OperationDef[] {
  // 验证操作定义
  for (const od of operations) {
    if (
      typeof od.value !== 'string' ||
      typeof od.name !== 'string' ||
      !Array.isArray(od.properties) ||
      typeof od.run !== 'function'
    ) {
      throw new Error(
        `Invalid operation definition: ${JSON.stringify({ value: od.value, name: od.name })}`,
      );
    }
  }

  // 去重校验
  const seen: Record<string, number> = {};
  for (const o of operations) seen[o.value] = (seen[o.value] ?? 0) + 1;
  if (Object.values(seen).some((c) => c > 1)) {
    const dupList = Object.entries(seen)
      .filter(([, c]) => c > 1)
      .map(([v, c]) => `${v} x${c}`)
      .join(', ');
    throw new Error(`Duplicate operations: ${dupList}`);
  }

  // 按照 value 排序
  const sorted = [...operations];
  sorted.sort((a, b) => a.value.localeCompare(b.value, 'zh-Hans-CN'));
  return sorted;
}

/** 生成资源包: 传入资源名/值 + 操作列表 */
export function makeResourceBundle(args: {
  value: string;
  name: string;
  operations: OperationDef[];
  methods?: MethodsBundle;
}): ResourceBundle {
  const { value, name, methods } = args;
  const operations = processOperations(args.operations);

  const operationProperty: INodeProperties = {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: [value] } },
    options: operations.map((o) => ({
      name: o.name,
      value: o.value,
      action: `${name} ${o.action ?? o.name}`,
      description: o.description,
    })),
    default: '', // 让用户显式选择
  };

  const properties = attachResourceShow(
    operations.flatMap((o) => o.properties),
    value,
  );

  return { value, name, operations, operationProperty, properties, methods };
}
