import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'workflow.processes.instances.spacesInfos';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '用户的userId',
    name: 'userId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '应用的AgentID(可选)',
    name: 'agentId',
    type: 'string',
    default: '',
    description:
      '<a href="https://open.dingtalk.com/document/development/basic-concepts-beta#884d363067bnq" target="_blank">查看AgentId说明</a>',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取审批钉盘空间信息',
  description: '获取审批钉盘空间的ID并授予当前用户上传附件的权限',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const userId = this.getNodeParameter('userId', itemIndex, undefined) as string;
    const agentId = this.getNodeParameter('agentId', itemIndex, undefined) as number;

    const body = {
      userId,
      agentId,
    } as IDataObject;

    const resp = await request.call(this, {
      method: 'POST',
      url: '/workflow/processInstances/spaces/infos/query',
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return {
      json: out,
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
