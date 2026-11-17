import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'user.listLeaveRecords';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '开始时间',
    name: 'startTime',
    type: 'dateTime',
    default: '',
    required: true,
    description: '查询时间范围不超过 365 天',
    displayOptions: showOnly,
  },
  {
    displayName: '结束时间',
    name: 'endTime',
    type: 'dateTime',
    default: '',
    displayOptions: showOnly,
  },
  {
    displayName: '分页游标',
    name: 'nextToken',
    // eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
    type: 'string',
    default: '0',
    description: '首次传 0，后续使用返回的 nextToken',
    displayOptions: showOnly,
  },
  {
    displayName: '分页大小',
    name: 'maxResults',
    type: 'number',
    default: 50,
    required: true,
    typeOptions: { minValue: 1, maxValue: 50, numberPrecision: 0 },
    displayOptions: showOnly,
  },
];

function formatDateTime(value: string): string {
  return new Date(value).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

const op: OperationDef = {
  value: OP,
  name: '查询离职记录列表',
  description: '按时间范围分页查询企业离职记录',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const qs: IDataObject = {
      startTime: formatDateTime(this.getNodeParameter('startTime', itemIndex) as string),
      maxResults: this.getNodeParameter('maxResults', itemIndex, 50) as number,
    };
    const endTime = this.getNodeParameter('endTime', itemIndex, '') as string;
    const nextToken = this.getNodeParameter('nextToken', itemIndex, '0') as string;
    if (endTime) qs.endTime = formatDateTime(endTime);
    if (nextToken) qs.nextToken = nextToken;

    const resp = await request.call(this, {
      method: 'GET',
      url: '/contact/empLeaveRecords',
      qs,
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
