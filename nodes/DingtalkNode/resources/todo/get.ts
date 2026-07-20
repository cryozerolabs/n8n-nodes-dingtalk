import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { encodePath, getTaskId, getUnionId, taskIdProperty, unionIdProperty } from './common';

const OP = 'todo.task.get';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [unionIdProperty(showOnly), taskIdProperty(showOnly)];

const op: OperationDef = {
  value: OP,
  name: '获取待办任务详情',
  description: '根据待办任务 ID 获取钉钉待办详情',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const unionId = getUnionId(this, itemIndex);
    const taskId = getTaskId(this, itemIndex);

    const resp = await request.call(this, {
      method: 'GET',
      url: `/todo/users/${encodePath(unionId)}/tasks/${encodePath(taskId)}`,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
