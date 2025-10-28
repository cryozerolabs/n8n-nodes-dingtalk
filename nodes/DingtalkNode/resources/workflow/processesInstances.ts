import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'workflow.processes.instances';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '审批实例ID',
    name: 'processInstanceId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取单个审批实例详情',
  description: '根据审批实例ID，获取审批实例详情',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const processInstanceId = this.getNodeParameter(
      'processInstanceId',
      itemIndex,
      undefined,
    ) as number;

    const qs = {
      processInstanceId,
    } as IDataObject;

    const resp = await request.call(this, {
      method: 'GET',
      url: '/workflow/processInstances',
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
