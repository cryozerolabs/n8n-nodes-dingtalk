import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'department.list';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '父部门 ID',
    name: 'deptId',
    type: 'string',
    default: '',
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
  name: '获取部门列表',
  description: '获取直属下一级部门的基础信息',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const deptId = this.getNodeParameter('deptId', itemIndex, '') as string;
    const body: IDataObject = { language: this.getNodeParameter('language', itemIndex, 'zh_CN') };
    if (deptId !== undefined && deptId !== null && String(deptId).trim() !== '') {
      body.dept_id = Number(deptId);
    }
    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/department/listsub',
      body: body,
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
