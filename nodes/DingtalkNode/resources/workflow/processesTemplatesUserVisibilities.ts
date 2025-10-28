import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'workflow.processes.templates.userVisibilities';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '用户ID',
    name: 'userId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '分页大小',
    name: 'maxResults',
    type: 'number',
    default: 100,
    displayOptions: showOnly,
  },
  {
    displayName: '分页游标',
    name: 'nextToken',
    type: 'number',
    default: 0,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取指定用户可见的审批表单列表',
  description: '根据员工的userId分页获取该用户可见的审批表单列表',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const userId = this.getNodeParameter('userId', itemIndex, undefined) as number;
    const maxResults = this.getNodeParameter('maxResults', itemIndex, 100) as number;
    const nextToken = this.getNodeParameter('nextToken', itemIndex, 0) as number;

    const qs = {
      userId,
      maxResults,
      nextToken,
    } as IDataObject;
    const resp = await request.call(this, {
      method: 'GET',
      url: '/workflow/processes/userVisibilities/templates',
      qs,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return {
      json: out,
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
