import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'workflow.processes.instances.download';
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
  {
    displayName: '文件fileId',
    name: 'fileId',
    type: 'string',
    default: '',
    description: '调用 [获取单个审批实例详情] 获取fileId参数值。',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '是否包含评论中的附件',
    name: 'withCommentAttatchment',
    type: 'boolean',
    default: false,
    // eslint-disable-next-line n8n-nodes-base/node-param-description-boolean-without-whether
    description: '默认忽略评论中附件',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '下载审批附件',
  description: '获取审批文件下载授权，并且生成下载链接',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const processInstanceId = this.getNodeParameter(
      'processInstanceId',
      itemIndex,
      undefined,
    ) as string;
    const fileId = this.getNodeParameter('fileId', itemIndex, undefined) as string;
    const withCommentAttatchment = this.getNodeParameter(
      'withCommentAttatchment',
      itemIndex,
      false,
    ) as boolean;

    const body = {
      processInstanceId,
      fileId,
      withCommentAttatchment,
    } as IDataObject;

    const resp = await request.call(this, {
      method: 'POST',
      url: '/workflow/processInstances/spaces/files/urls/download',
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
