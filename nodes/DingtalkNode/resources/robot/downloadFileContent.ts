import {
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'robot.messageFile.download';
const showOnly = { show: { operation: [OP] } };

type ReturnType = 'url' | 'base64' | 'binary';

const properties: INodeProperties[] = [
  {
    displayName: '机器人编码',
    name: 'robotCode',
    type: 'string',
    default: '',
    required: true,
    description: '企业内部机器人编码（robotCode）',
    displayOptions: showOnly,
  },
  {
    displayName: '下载码',
    name: 'downloadCode',
    type: 'string',
    default: '',
    required: true,
    description: '机器人接收消息中的下载码（downloadCode）',
    displayOptions: showOnly,
  },
  {
    displayName: '返回类型',
    name: 'returnType',
    type: 'options',
    default: 'url',
    options: [
      { name: '原地址', value: 'url' },
      { name: 'Base64', value: 'base64' },
      { name: '二进制', value: 'binary' },
    ],
    description: '原地址直接返回 downloadUrl，其它类型会自动下载文件后转换',
    displayOptions: showOnly,
  },
];

function guessFileExt(downloadUrl: string, mimeType?: string): string {
  try {
    const { pathname } = new URL(downloadUrl);
    const lastSeg = pathname.split('/').pop() ?? '';
    const dotIdx = lastSeg.lastIndexOf('.');
    if (dotIdx > -1 && dotIdx < lastSeg.length - 1) {
      return lastSeg.slice(dotIdx + 1).toLowerCase();
    }
  } catch {
    // ignore url parse error
  }

  const mime = (mimeType ?? '').toLowerCase();
  const known: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  return known[mime] ?? 'bin';
}

const op: OperationDef = {
  value: OP,
  name: '下载机器人消息文件',
  description: '下载机器人接收消息中的文件内容，支持 URL/Base64/二进制 返回',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const robotCode = this.getNodeParameter('robotCode', itemIndex) as string;
    const downloadCode = this.getNodeParameter('downloadCode', itemIndex) as string;
    const returnType = this.getNodeParameter('returnType', itemIndex, 'url') as ReturnType;

    this.logger.debug('robot.messageFile.download request params', {
      robotCode,
      downloadCode,
      returnType,
    });

    const resp = (await request.call(this, {
      method: 'POST',
      url: '/robot/messageFiles/download',
      body: {
        robotCode,
        downloadCode,
      },
    })) as IDataObject;

    const result = (resp.result ?? {}) as IDataObject;
    const downloadUrl = (resp.downloadUrl ?? result.downloadUrl) as string | undefined;
    if (!downloadUrl) {
      throw new NodeOperationError(this.getNode(), '接口未返回 downloadUrl', { itemIndex });
    }

    this.logger.debug('robot.messageFile.download api response', { downloadUrl });

    if (returnType === 'url') {
      return {
        json: {
          downloadUrl,
        },
        pairedItem: { item: itemIndex },
      };
    }

    const fileResponse = (await this.helpers.httpRequest({
      method: 'GET',
      url: downloadUrl,
      json: false,
      encoding: 'arraybuffer',
      returnFullResponse: true,
    })) as {
      body: ArrayBuffer | Buffer;
      headers?: Record<string, string | string[] | undefined>;
      statusCode?: number;
    };
    const fileBuffer = Buffer.isBuffer(fileResponse.body)
      ? fileResponse.body
      : Buffer.from(fileResponse.body);

    const mimeType = String(fileResponse.headers?.['content-type'] ?? 'application/octet-stream');
    const fileExt = guessFileExt(downloadUrl, mimeType);

    this.logger.debug('robot.messageFile.download download done', {
      statusCode: fileResponse.statusCode,
      mimeType,
      fileExt,
      byteLength: fileBuffer.length,
    });

    if (returnType === 'base64') {
      return {
        json: {
          mineType: mimeType,
          fileExt,
          base64: fileBuffer.toString('base64'),
        },
        pairedItem: { item: itemIndex },
      };
    }

    const binaryPropertyName = 'data';
    const binaryData = await this.helpers.prepareBinaryData(
      fileBuffer,
      `robot_message_file.${fileExt}`,
      mimeType,
    );

    return {
      json: {
        mineType: mimeType,
        fileExt,
      },
      binary: {
        [binaryPropertyName]: binaryData,
      },
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
