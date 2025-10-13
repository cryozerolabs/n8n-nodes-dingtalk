import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'user.search';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '用户名称、名称拼音或英文名称',
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
    displayOptions: showOnly,
  },
  {
    displayName: '分页大小',
    name: 'size',
    type: 'number',
    default: 10,
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '是否精确匹配',
    name: 'fullMatchField',
    type: 'boolean',
    default: false,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '搜索用户userId',
  description: '获取指定用户的详细信息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const offset = this.getNodeParameter('offset', itemIndex, 1) as number;
    const size = this.getNodeParameter('size', itemIndex, 10) as number;
    const queryWord = this.getNodeParameter('queryWord', itemIndex, '') as string;
    const fullMatchField = this.getNodeParameter('fullMatchField', itemIndex, false) as boolean;

    const body = {
      offset,
      size,
      queryWord,
    } as IDataObject;
    body.queryWord = queryWord;
    if (fullMatchField) {
      body.fullMatchField = 1;
    }
    const resp = await request.call(this, {
      method: 'POST',
      url: '/contact/users/search',
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return {
      json: out,
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
