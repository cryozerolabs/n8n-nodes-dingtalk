import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'user.listDepartmentUserDetails';
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
  {
    displayName: '分页游标',
    name: 'cursor',
    type: 'number',
    default: 0,
    required: true,
    typeOptions: { minValue: 0, numberPrecision: 0 },
    description: '首次传 0，后续使用返回的 next_cursor',
    displayOptions: showOnly,
  },
  {
    displayName: '分页大小',
    name: 'size',
    type: 'number',
    default: 10,
    required: true,
    typeOptions: { minValue: 1, maxValue: 100, numberPrecision: 0 },
    displayOptions: showOnly,
  },
  {
    displayName: '排序规则',
    name: 'orderField',
    type: 'options',
    default: 'custom',
    options: [
      { name: '自定义', value: 'custom' },
      { name: '进入部门时间升序', value: 'entry_asc' },
      { name: '进入部门时间降序', value: 'entry_desc' },
      { name: '部门信息修改时间升序', value: 'modify_asc' },
      { name: '部门信息修改时间降序', value: 'modify_desc' },
    ],
    displayOptions: showOnly,
  },
  {
    displayName: '返回访问受限员工',
    name: 'containAccessLimit',
    type: 'boolean',
    default: false,
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
  name: '获取部门用户详情列表',
  description: '分页获取当前部门成员的详细信息，不含子部门成员',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const body = {
      dept_id: Number(this.getNodeParameter('deptId', itemIndex)),
      cursor: this.getNodeParameter('cursor', itemIndex, 0) as number,
      size: this.getNodeParameter('size', itemIndex, 10) as number,
      order_field: this.getNodeParameter('orderField', itemIndex, 'custom') as string,
      contain_access_limit: this.getNodeParameter(
        'containAccessLimit',
        itemIndex,
        false,
      ) as boolean,
      language: this.getNodeParameter('language', itemIndex, 'zh_CN') as string,
    };
    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/user/list',
      body,
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
