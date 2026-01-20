import {
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';

const OP = 'doc.resource.upload';
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
    displayName: '二进制文件字段',
    name: 'inputDataFieldName',
    type: 'string',
    default: 'data',
    required: true,
    description: '要处理的二进制文件数据所对应的传入字段名称，例如 data',
    displayOptions: showOnly,
  },
];

const op: OperationDef = {
  value: OP,
  name: '获取资源上传信息并上传',
  description: '获取文档指定资源的上传地址，并上传附件到该资源',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const operatorId = await getOperatorId(this, itemIndex);
    const docId = this.getNodeParameter('docId', itemIndex) as string;

    // 处理文件来源为指定文件
    const inputDataFieldName = this.getNodeParameter('inputDataFieldName', itemIndex) as string;
    const binaryData = this.helpers.assertBinaryData(itemIndex, inputDataFieldName);
    const uploadBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, inputDataFieldName);

    if (!binaryData) {
      throw new NodeOperationError(this.getNode(), '未找到需要上传的文件数据', { itemIndex });
    }

    const fileInfo = {
      filename: binaryData.fileName ?? 'file',
      size: uploadBuffer.length || 0,
      type: binaryData.mimeType,
    };

    // 获取资源上传信息
    const uploadInfoResp = (await request.call(this, {
      method: 'POST',
      url: `/doc/docs/resources/${docId}/uploadInfos/query?operatorId=${operatorId}`,
      body: {
        size: fileInfo.size,
        mediaType: fileInfo.type,
        resourceName: fileInfo.filename,
      },
    })) as IDataObject;

    this.logger.debug('uploadInfoResp', uploadInfoResp);

    const result = uploadInfoResp?.result as {
      resourceId: string;
      resourceUrl: string;
      uploadUrl: string;
    };
    const { resourceId, resourceUrl, uploadUrl } = result;

    if (!uploadUrl) {
      throw new NodeOperationError(this.getNode(), '未获取到上传地址', { itemIndex });
    }

    await request.call(this, {
      method: 'PUT',
      url: uploadUrl,
      headers: {
        'Content-Type': fileInfo.type,
      },
      body: uploadBuffer,
      json: false,
      encoding: undefined,
    });

    return {
      json: {
        ...fileInfo,
        resourceId,
        url: resourceUrl,
      },
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
