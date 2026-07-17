import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { buildListTasksBody, encodePath, getUnionId, unionIdProperty } from './common';

const OP = 'todo.task.list';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  unionIdProperty(showOnly),
  {
    displayName: '完成状态',
    name: 'doneFilter',
    type: 'options',
    default: 'unfinished',
    options: [
      { name: '未完成', value: 'unfinished' },
      { name: '已完成', value: 'finished' },
      { name: '全部', value: 'all' },
    ],
    displayOptions: showOnly,
  },
  {
    displayName: '下一页游标',
    name: 'nextPageCursor',
    type: 'string',
    default: '',
    description: '接口返回的 nextToken，用于继续查询下一页。',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '查询企业待办列表',
  description: '查询企业下指定用户的钉钉待办列表',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const unionId = getUnionId(this, itemIndex);
    const doneFilter = this.getNodeParameter('doneFilter', itemIndex, 'unfinished') as string;
    const nextPageCursor = this.getNodeParameter('nextPageCursor', itemIndex, '') as string;

    const isDone =
      doneFilter === 'finished' ? true : doneFilter === 'unfinished' ? false : undefined;

    const resp = await request.call(this, {
      method: 'POST',
      url: `/todo/users/${encodePath(unionId)}/org/tasks/query`,
      body: buildListTasksBody({ nextToken: nextPageCursor, isDone }),
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
