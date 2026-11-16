import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'department.get';
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
  {
    displayName: '通讯录语言',
    name: 'language',
    type: 'options',
    default: 'zh_CN',
    options: [
      { name: '中文', value: 'zh_CN' },
      { name: '英文', value: 'en_US' },
    ],
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取部门详情',
  description: '根据部门 ID 获取部门详情',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/department/get',
      body: {
        dept_id: Number(this.getNodeParameter('deptId', itemIndex)),
        language: this.getNodeParameter('language', itemIndex, 'zh_CN'),
      },
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
