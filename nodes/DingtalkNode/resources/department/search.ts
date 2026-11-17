import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'department.search';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '部门名称或拼音',
    name: 'queryWord',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '分页页码',
    name: 'offset',
    type: 'number',
    default: 0,
    required: true,
    typeOptions: { minValue: 0, numberPrecision: 0 },
    displayOptions: showOnly,
  },
  {
    displayName: '分页大小',
    name: 'size',
    type: 'number',
    default: 10,
    required: true,
    typeOptions: { minValue: 1, numberPrecision: 0 },
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '搜索部门 ID',
  description: '按名称或拼音分页搜索部门 ID',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const body = {
      queryWord: this.getNodeParameter('queryWord', itemIndex) as string,
      offset: this.getNodeParameter('offset', itemIndex, 0) as number,
      size: this.getNodeParameter('size', itemIndex, 10) as number,
    };
    const resp = await request.call(this, {
      method: 'POST',
      url: '/contact/departments/search',
      body,
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
