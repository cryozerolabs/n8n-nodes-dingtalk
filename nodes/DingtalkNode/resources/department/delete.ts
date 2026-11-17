import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'department.delete';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '部门 ID',
    name: 'deptId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '删除部门',
  description: '根据部门 ID 删除部门',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/department/delete',
      body: { dept_id: Number(this.getNodeParameter('deptId', itemIndex)) },
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
