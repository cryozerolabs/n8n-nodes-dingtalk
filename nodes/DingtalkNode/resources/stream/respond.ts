import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { STREAM_RESPONSE_TYPE } from './common';

const OP = 'stream.respond';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: 'Stream 触发器需选择“使用响应节点”。',
    name: 'responseNotice',
    type: 'notice',
    default: '',
    displayOptions: showOnly,
  },
  {
    displayName: '响应状态',
    name: 'status',
    type: 'options',
    default: 'SUCCESS',
    options: [
      { name: '消费失败，请求重投 (LATER)', value: 'LATER' },
      { name: '消费成功 (SUCCESS)', value: 'SUCCESS' },
    ],
    displayOptions: showOnly,
  },
  {
    displayName: '响应说明',
    name: 'message',
    type: 'string',
    default: '',
    description: '随事件确认返回给钉钉的说明',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '响应事件',
  action: '响应 Stream 事件',
  description: '回复当前 Stream EVENT 事件，确认成功或请求重投',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    if (itemIndex === 0) {
      const status = this.getNodeParameter('status', itemIndex) as string;
      if (status !== 'SUCCESS' && status !== 'LATER') {
        throw new NodeOperationError(this.getNode(), '响应状态必须是 SUCCESS 或 LATER', {
          itemIndex,
        });
      }
      await this.sendResponse({
        type: STREAM_RESPONSE_TYPE,
        status,
        message: this.getNodeParameter('message', itemIndex, '') as string,
      });
    }
    return { ...this.getInputData()[itemIndex], pairedItem: { item: itemIndex } };
  },
};

export default op;
