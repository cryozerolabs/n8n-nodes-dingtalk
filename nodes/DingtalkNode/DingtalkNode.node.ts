import {
  NodeConnectionType,
  type INodeType,
  type INodeTypeDescription,
  type INodeProperties,
  type INodeExecutionData,
  type IExecuteFunctions,
  NodeOperationError,
  ApplicationError,
} from 'n8n-workflow';
import type { ResourceBundle } from '../shared/resource';
import type { OperationDef } from '../shared/operation';
import authBundle from './resources/auth';
import notableBundle from './resources/notable';
import userBundle from './resources/user';

// 静态导入所有资源包
const bundles: ResourceBundle[] = [authBundle, notableBundle, userBundle];

// 资源去重校验
const seen: Record<string, number> = {};
for (const b of bundles) seen[b.value] = (seen[b.value] ?? 0) + 1;
const dups = Object.entries(seen).filter(([, c]) => c > 1);
if (dups.length) {
  throw new ApplicationError(`Duplicate resource detected: ${dups.map(([v]) => v).join(', ')}`);
}

// 排序
bundles.sort((a, b) => a.value.localeCompare(b.value, 'zh-Hans-CN'));

// Resource 下拉
const resourceProperty: INodeProperties = {
  displayName: 'Resource',
  name: 'resource',
  type: 'options',
  noDataExpression: true,
  options: bundles.map((b) => ({ name: b.name, value: b.value })),
  default: '', // 让用户显式选择
};

// 每个资源自己的 Operation 参数（带 show.resource）+ 参数集合（已补 show.resource）
const resourceOperationProps: INodeProperties[] = bundles.map((b) => b.operationProperty);
const aggregatedParams: INodeProperties[] = bundles.flatMap((b) => b.properties);

// 运行期操作查找表
const allOps: OperationDef[] = bundles.flatMap((b) => b.operations);
const opMap = new Map(allOps.map((o) => [o.value, o]));

export class DingtalkNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Dingtalk Node',
    name: 'dingtalkNode',
    // eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
    icon: 'file:icon.png',
    group: ['transform'],
    version: 1,
    // 副标题: 显示 “资源 · 操作短名”
    subtitle: '={{$parameter["operation"]}}',
    description: 'Interact with the Dingtalk API',
    defaults: { name: 'Dingtalk Node' },
    usableAsTool: true,
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [{ name: 'dingtalkApi', required: true }],
    properties: [resourceProperty, ...resourceOperationProps, ...aggregatedParams],
  };

  async execute(this: IExecuteFunctions) {
    const items = this.getInputData();
    const results: INodeExecutionData[] = [];

    const opValue = this.getNodeParameter('operation', 0) as string;
    const op = opMap.get(opValue);
    if (!op) {
      throw new NodeOperationError(
        this.getNode(),
        `Operation "${opValue || '<empty>'}" not found`,
        { itemIndex: 0 },
      );
    }

    for (let i = 0; i < items.length; i++) {
      try {
        const out = await op.run.call(this, i);
        results.push(out);
      } catch (error) {
        if (this.continueOnFail()) {
          results.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
        } else {
          if ((error as NodeOperationError).context) {
            (error as NodeOperationError).context!.itemIndex = i;
          }
          throw error;
        }
      }
    }

    return this.prepareOutputData(results);
  }
}
