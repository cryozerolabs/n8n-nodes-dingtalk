import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'user.listDepartmentUserIds';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '部门 ID',
    name: 'deptId',
    type: 'string',
    default: '',
    required: true,
    description: '根部门 ID 为 1',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取部门用户 ID 列表',
  description: '获取指定部门的用户 ID 列表',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/user/listid',
      body: { dept_id: Number(this.getNodeParameter('deptId', itemIndex)) },
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
