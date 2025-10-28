import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import {
  commaSeparatedStringProperty,
  getCommaSeparatedValues,
} from '../../../shared/properties/commaSeparatedString';

const OP = 'workflow.processes.instanceIds';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '审批流的唯一码',
    name: 'processCode',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '审批实例开始时间',
    name: 'startTime',
    type: 'dateTime',
    default: '',
    required: true,
    description:
      'Unix时间戳，单位毫秒。例如：2020.4.10-2020.4.14之间，该值传2020.4.10 00:00:00对应的时间戳1586448000000。',
    displayOptions: showOnly,
  },
  {
    displayName: '审批实例结束时间',
    name: 'endTime',
    type: 'dateTime',
    default: '',
    description:
      'Unix时间戳，单位毫秒。例如：2020.4.10-2020.4.14之间，该值传2020.4.14 23:59:59对应的时间戳1586879999000。',
    displayOptions: showOnly,
  },
  commaSeparatedStringProperty({
    displayName: '发起人userId列表',
    name: 'userIds',
    description: '发起人userId列表，最大列表长度为10',
    default: '',
    displayOptions: showOnly,
  }),
  {
    displayName: '流程实例状态',
    name: 'statusList',
    type: 'multiOptions',
    default: [],
    options: [
      { name: '审批中', value: 'RUNNING' },
      { name: '已撤销', value: 'TERMINATED' },
      { name: '审批完成', value: 'COMPLETED' },
      { name: '审批完成(有空值)', value: 'COMPLETED_WITH_BLANKS' },
    ],
    description:
      '默认全部状态。RUNNING：审批中; TERMINATED：已撤销; COMPLETED：审批完成;COMPLETED_WITH_BLANKS：审批完成(有空值);',
    displayOptions: showOnly,
  },
  {
    displayName: '分页大小',
    name: 'maxResults',
    type: 'number',
    default: 20,
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
  name: '获取审批实例ID列表',
  description: '获取权限范围内的相关部门审批实例ID列表',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const processCode = this.getNodeParameter('processCode', itemIndex, undefined) as number;
    const startTime = this.getNodeParameter('startTime', itemIndex, undefined) as string;
    const endTime = this.getNodeParameter('endTime', itemIndex, undefined) as string;
    const statusList = this.getNodeParameter('statusList', itemIndex, []) as string[];
    const maxResults = this.getNodeParameter('maxResults', itemIndex, 20) as number;
    const nextToken = this.getNodeParameter('nextToken', itemIndex, 0) as number;
    const userIds = getCommaSeparatedValues(this, itemIndex, 'userIds');

    const body = {
      processCode,
      maxResults,
      nextToken,
      ...(statusList?.length > 0 ? { startTime } : {}),
      ...(userIds?.length > 0 ? { userIds } : {}),
    } as IDataObject;

    if (startTime) {
      // 如果startTime不为空，且本不是数字，转换成unix时间戳
      if (isNaN(Number(startTime))) {
        body.startTime = new Date(startTime).getTime();
      } else {
        body.startTime = Number(startTime);
      }
    }
    if (endTime) {
      // 如果endTime不为空，且本不是数字，转换成unix时间戳
      if (isNaN(Number(endTime))) {
        body.endTime = new Date(endTime).getTime();
      } else {
        body.endTime = Number(endTime);
      }
    }

    const resp = await request.call(this, {
      method: 'POST',
      url: '/workflow/processes/instanceIds/query',
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
