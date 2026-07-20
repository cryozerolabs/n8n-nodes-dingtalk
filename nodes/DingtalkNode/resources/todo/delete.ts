import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';
import {
  encodePath,
  getTaskId,
  getUnionId,
  taskIdProperty,
  unionIdProperty,
} from './common';

const OP = 'todo.task.delete';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  unionIdProperty(showOnly),
  taskIdProperty(showOnly),
  ...operatorProps(showOnly),
];

const op: OperationDef = {
  value: OP,
  name: '删除待办任务',
  description: '删除钉钉工作待办任务',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const unionId = getUnionId(this, itemIndex);
    const taskId = getTaskId(this, itemIndex);
    const operatorId = await getOperatorId(this, itemIndex);

    const resp = await request.call(this, {
      method: 'DELETE',
      url: `/todo/users/${encodePath(unionId)}/tasks/${encodePath(taskId)}`,
      qs: { operatorId },
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
