import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import { commaSeparatedStringProperty } from '../../../shared/properties/commaSeparatedString';
import { getOptionalOperatorId, operatorProps } from '../../../shared/properties/operator';
import {
  buildExecutorStatusBody,
  encodePath,
  getTaskId,
  getUnionId,
  splitCommaSeparatedValues,
  taskIdProperty,
  unionIdProperty,
} from './common';

const OP = 'todo.task.updateExecutorStatus';
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  commaSeparatedStringProperty({
    displayName: '执行人 Union ID 列表',
    name: 'executorIds',
    required: true,
    placeholder: 'unionId1, unionId2',
    displayOptions: showOnly,
  }),
  {
    displayName: '是否完成',
    name: 'isDone',
    type: 'boolean',
    default: true,
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
        executorStatusList: [
          {
            id: 'executorUnionId',
            isDone: true,
          },
        ],
      },
      null,
      2,
    ),
    jsonDescription:
      '请求体 JSON 数据。<a href="https://open.dingtalk.com/document/development/update-dingtalk-to-do-executor-status" target="_blank">查看官方 API 文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '更新执行人完成状态',
  description: '更新钉钉待办指定执行人的完成状态',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const unionId = getUnionId(this, itemIndex);
    const taskId = getTaskId(this, itemIndex);
    const operatorId = await getOptionalOperatorId(this, itemIndex);

    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const executorIds = ctx.getNodeParameter('executorIds', idx, undefined);
        if (splitCommaSeparatedValues(executorIds).length === 0) {
          throw new NodeOperationError(ctx.getNode(), '请至少填写一个执行人 Union ID', {
            itemIndex: idx,
          });
        }

        const isDone = ctx.getNodeParameter('isDone', idx, true) as boolean;
        return buildExecutorStatusBody(executorIds, isDone);
      },
    });

    const resp = await request.call(this, {
      method: 'PUT',
      url: `/todo/users/${encodePath(unionId)}/tasks/${encodePath(taskId)}/executorStatus`,
      qs: operatorId ? { operatorId } : undefined,
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
