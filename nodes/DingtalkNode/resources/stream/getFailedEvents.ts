import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'stream.getFailedEvents';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '失败事件读取后可能不再返回，请及时保存。',
    name: 'failedEventsNotice',
    type: 'notice',
    default: '',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取推送失败事件',
  description: '获取当前应用推送失败的事件，单次最多 200 条',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const resp = await request.call(this, {
      method: 'GET',
      url: 'https://oapi.dingtalk.com/call_back/get_call_back_failed_result',
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
