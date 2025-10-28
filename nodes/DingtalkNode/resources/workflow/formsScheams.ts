import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'workflow.forms.schemas';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '表单的唯一码',
    name: 'processCode',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '应用搭建隔离信息',
    name: 'appUuid',
    type: 'string',
    default: '',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取表单Schema',
  description: '通过 processCode，获取对应表单的 schema 信息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const processCode = this.getNodeParameter('processCode', itemIndex, undefined) as number;
    const appUuid = this.getNodeParameter('appUuid', itemIndex, undefined) as number;

    const qs = {
      processCode,
      appUuid,
    } as IDataObject;
    const resp = await request.call(this, {
      method: 'GET',
      url: '/workflow/forms/schemas/processCodes',
      qs,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return {
      json: out,
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
