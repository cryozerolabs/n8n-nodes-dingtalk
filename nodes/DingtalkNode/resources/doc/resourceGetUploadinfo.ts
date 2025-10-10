import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'doc.resource.getUploadInfo';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  {
    displayName: '文档ID',
    name: 'docId',
    type: 'string',
    default: '',
    required: true,
    hint: 'dentryUuid/documentId/workbookId/baseId',
    displayOptions: showOnly,
  },
  {
    displayName: '资源大小',
    name: 'size',
    type: 'number',
    default: 0,
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '资源类型',
    name: 'mediaType',
    type: 'string',
    default: '',
    required: true,
    placeholder: 'image/jpeg',
    description:
      '具体值参考<a href="https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Guides/MIME_types/Common_types" target="_blank">MIME类型</a>',
    displayOptions: showOnly,
  },
  {
    displayName: '资源名称',
    name: 'resourceName',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取资源上传信息',
  description: '查询文档指定资源的上传地址',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const docId = this.getNodeParameter('docId', itemIndex) as string;
    const size = this.getNodeParameter('size', itemIndex) as number;
    const mediaType = this.getNodeParameter('mediaType', itemIndex) as string;
    const resourceName = this.getNodeParameter('resourceName', itemIndex) as string;

    const operatorId = await getOperatorId(this, itemIndex);

    const resp = await request.call(this, {
      method: 'POST',
      url: `/doc/docs/resources/${docId}/uploadInfos/query?operatorId=${operatorId}`,
      body: {
        size,
        mediaType,
        resourceName,
      },
    });
    const out: IDataObject = resp as unknown as IDataObject;

    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
