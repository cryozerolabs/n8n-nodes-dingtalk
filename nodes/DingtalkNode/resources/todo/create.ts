import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import { commaSeparatedStringProperty } from '../../../shared/properties/commaSeparatedString';
import { getOptionalOperatorId, operatorProps } from '../../../shared/properties/operator';
import {
  buildCreateTaskBody,
  encodePath,
  getUnionId,
  unionIdProperty,
} from './common';

const OP = 'todo.task.create';
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  {
    displayName: '业务系统唯一 ID',
    name: 'sourceId',
    type: 'string',
    default: '',
    description: '业务系统侧的待办唯一标识，用于幂等创建和后续按 sourceId 查询。',
    displayOptions: showOnly,
  },
  {
    displayName: '标题',
    name: 'subject',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '创建人 Union ID',
    name: 'creatorId',
    type: 'string',
    default: '',
    description: '待办创建人的 unionId。留空时使用操作人 unionId。',
    displayOptions: showOnly,
  },
  {
    displayName: '描述',
    name: 'description',
    type: 'string',
    typeOptions: {
      rows: 3,
    },
    default: '',
    displayOptions: showOnly,
  },
  {
    displayName: '截止时间',
    name: 'dueTime',
    type: 'string',
    default: '',
    placeholder: '2026-07-17T18:30:00+08:00 或 1784284200000',
    description: '支持 ISO-8601 时间字符串或毫秒时间戳。',
    displayOptions: showOnly,
  },
  commaSeparatedStringProperty({
    displayName: '执行人 Union ID 列表',
    name: 'executorIds',
    placeholder: 'unionId1, unionId2',
    displayOptions: showOnly,
  }),
  commaSeparatedStringProperty({
    displayName: '参与人 Union ID 列表',
    name: 'participantIds',
    placeholder: 'unionId1, unionId2',
    displayOptions: showOnly,
  }),
  {
    displayName: '移动端详情页 URL',
    name: 'detailUrl',
    type: 'string',
    default: '',
    description: '用户在钉钉待办中点击后打开的移动端详情页地址。',
    displayOptions: showOnly,
  },
  {
    displayName: 'PC 端详情页 URL',
    name: 'pcDetailUrl',
    type: 'string',
    default: '',
    description: '留空时复用移动端详情页 URL。',
    displayOptions: showOnly,
  },
  {
    displayName: '优先级',
    name: 'priority',
    type: 'options',
    default: 20,
    options: [
      { name: '低', value: 10 },
      { name: '普通', value: 20 },
      { name: '较高', value: 30 },
      { name: '紧急', value: 40 },
    ],
    displayOptions: showOnly,
  },
  {
    displayName: '仅执行人可见',
    name: 'isOnlyShowExecutor',
    type: 'boolean',
    default: false,
    displayOptions: showOnly,
  },
  {
    displayName: '发送 DING 通知',
    name: 'dingNotify',
    type: 'boolean',
    default: false,
    displayOptions: showOnly,
  },
];

const properties: INodeProperties[] = [
  unionIdProperty(showOnly),
  ...operatorProps(showOnly, { required: false }),
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        sourceId: 'task-001',
        subject: '提交周报',
        creatorId: 'creatorUnionId',
        executorIds: ['executorUnionId'],
        participantIds: ['participantUnionId'],
        detailUrl: {
          appUrl: 'https://example.com/tasks/task-001',
          pcUrl: 'https://example.com/tasks/task-001',
        },
        dueTime: 1784284200000,
        priority: 20,
      },
      null,
      2,
    ),
    jsonDescription:
      '请求体 JSON 数据。<a href="https://open.dingtalk.com/document/development/add-dingtalk-to-do-task" target="_blank">查看官方 API 文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '创建待办任务',
  description: '创建钉钉工作待办任务',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const unionId = getUnionId(this, itemIndex);
    const operatorId = await getOptionalOperatorId(this, itemIndex);

    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) =>
        buildCreateTaskBody({
          sourceId: ctx.getNodeParameter('sourceId', idx, undefined),
          subject: ctx.getNodeParameter('subject', idx, undefined),
          creatorId: ctx.getNodeParameter('creatorId', idx, '') || operatorId,
          description: ctx.getNodeParameter('description', idx, undefined),
          dueTime: ctx.getNodeParameter('dueTime', idx, undefined),
          executorIds: ctx.getNodeParameter('executorIds', idx, undefined),
          participantIds: ctx.getNodeParameter('participantIds', idx, undefined),
          detailUrl: ctx.getNodeParameter('detailUrl', idx, undefined),
          pcDetailUrl: ctx.getNodeParameter('pcDetailUrl', idx, undefined),
          priority: ctx.getNodeParameter('priority', idx, undefined),
          isOnlyShowExecutor: ctx.getNodeParameter('isOnlyShowExecutor', idx, false),
          dingNotify: ctx.getNodeParameter('dingNotify', idx, false),
        }),
    });

    const resp = await request.call(this, {
      method: 'POST',
      url: `/todo/users/${encodePath(unionId)}/tasks`,
      qs: operatorId ? { operatorId } : undefined,
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
