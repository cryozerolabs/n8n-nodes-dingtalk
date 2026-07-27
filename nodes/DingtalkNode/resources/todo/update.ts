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
  buildUpdateTaskBody,
  encodePath,
  getTaskId,
  getUnionId,
  taskIdProperty,
  unionIdProperty,
} from './common';

const OP = 'todo.task.update';
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  {
    displayName: '标题',
    name: 'subject',
    type: 'string',
    default: '',
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
    description: '支持 ISO-8601 时间字符串或毫秒时间戳。留空则不更新。',
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
    displayName: '完成状态',
    name: 'doneStatus',
    type: 'options',
    default: 'unchanged',
    options: [
      { name: '不更新', value: 'unchanged' },
      { name: '标记未完成', value: 'undone' },
      { name: '标记完成', value: 'done' },
    ],
    displayOptions: showOnly,
  },
];

const properties: INodeProperties[] = [
  unionIdProperty(showOnly),
  taskIdProperty(showOnly),
  ...operatorProps(showOnly, { required: false }),
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        subject: '更新后的标题',
        description: '更新后的描述',
        executorIds: ['executorUnionId'],
        participantIds: ['participantUnionId'],
        dueTime: 1784284200000,
        done: false,
      },
      null,
      2,
    ),
    jsonDescription:
      '请求体 JSON 数据。<a href="https://open.dingtalk.com/document/development/updates-dingtalk-to-do-tasks" target="_blank">查看官方 API 文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '更新待办任务',
  description: '更新钉钉工作待办任务',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const unionId = getUnionId(this, itemIndex);
    const taskId = getTaskId(this, itemIndex);
    const operatorId = await getOptionalOperatorId(this, itemIndex);

    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const doneStatus = ctx.getNodeParameter('doneStatus', idx, 'unchanged') as string;
        const done =
          doneStatus === 'done' ? true : doneStatus === 'undone' ? false : undefined;

        return buildUpdateTaskBody({
          subject: ctx.getNodeParameter('subject', idx, undefined),
          description: ctx.getNodeParameter('description', idx, undefined),
          dueTime: ctx.getNodeParameter('dueTime', idx, undefined),
          executorIds: ctx.getNodeParameter('executorIds', idx, undefined),
          participantIds: ctx.getNodeParameter('participantIds', idx, undefined),
          done,
        });
      },
    });

    const resp = await request.call(this, {
      method: 'PUT',
      url: `/todo/users/${encodePath(unionId)}/tasks/${encodePath(taskId)}`,
      qs: operatorId ? { operatorId } : undefined,
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
