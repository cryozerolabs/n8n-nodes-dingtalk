import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { encodePath, getUnionId, unionIdProperty } from './common';

const OP = 'todo.task.getBySourceId';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  unionIdProperty(showOnly),
  {
    displayName: '业务系统唯一 ID',
    name: 'sourceId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '按 Source ID 获取详情',
  description: '根据业务系统唯一 ID 获取钉钉待办详情',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const unionId = getUnionId(this, itemIndex);
    const sourceId = this.getNodeParameter('sourceId', itemIndex) as string;

    const resp = await request.call(this, {
      method: 'GET',
      url: `/todo/users/${encodePath(unionId)}/tasks/sources/${encodePath(sourceId)}`,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
