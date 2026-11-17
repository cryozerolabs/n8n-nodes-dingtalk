import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'department.listSubIds';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '父部门 ID',
    name: 'deptId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取子部门 ID 列表',
  description: '获取直属下一级部门 ID，不递归查询',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/department/listsubid',
      body: { dept_id: Number(this.getNodeParameter('deptId', itemIndex)) },
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
