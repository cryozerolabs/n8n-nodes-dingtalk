import {
  NodeOperationError,
  type IDataObject,
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'robot.media.upload';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
  {
    displayName: '媒体文件类型',
    name: 'mediaType',
    type: 'options',
    default: 'file',
    required: true,
    options: [
      {
        name: '图片（jpg/gif/png/bmp，最大20MB）',
        value: 'image',
      },
      {
        name: '语音（amr/mp3/wav，最大2MB）',
        value: 'voice',
      },
      {
        name: '视频（mp4，最大20MB）',
        value: 'video',
      },
      {
        name: '文件（doc/docx/xls/xlsx/ppt/pptx/zip/pdf/rar，最大20MB）',
        value: 'file',
      },
    ],
    displayOptions: showOnly,
  },
  {
    displayName: '二进制文件字段',
    name: 'inputDataFieldName',
    type: 'string',
    default: 'data',
    required: true,
    description: '要上传的二进制文件数据所对应的传入字段名称，例如 data',
    displayOptions: showOnly,
  },
  {
    displayName: '文件名',
    name: 'fileName',
    type: 'string',
    default: '',
    displayOptions: showOnly,
    description:
      '上传使用的文件名，留空时取二进制数据的文件名。注意：中文文件名可能导致上传失败，建议使用英文文件名',
  },
];

/**
 * 手工构造 multipart/form-data 报文。
 * 不使用 n8n 的 formData 选项：不同 n8n 版本的请求链路对 formData 支持不一致，
 * 而纯 Buffer 拼装的报文在任何版本都能原样发送。
 */
export function buildMultipartBody(options: {
  boundary: string;
  mediaType: string;
  fileName: string;
  mimeType: string;
  file: Buffer;
}): Buffer {
  const { boundary, mediaType, fileName, mimeType, file } = options;
  // 文件名写入 Content-Disposition 头，需去掉引号/反斜杠/换行，避免破坏报文结构
  const safeFileName = fileName.replace(/["\\\r\n]/g, '_');
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="type"\r\n\r\n${mediaType}\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${safeFileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

const op: OperationDef = {
  value: OP,
  name: '上传媒体文件',
  description:
    '上传图片、语音、视频或普通文件，返回media_id，用于机器人发送图片/语音/文件/视频消息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const mediaType = this.getNodeParameter('mediaType', itemIndex, 'file') as string;
    const inputDataFieldName = this.getNodeParameter('inputDataFieldName', itemIndex, 'data') as string;
    const fileNameOverride = this.getNodeParameter('fileName', itemIndex, '') as string;

    const binaryData = this.helpers.assertBinaryData(itemIndex, inputDataFieldName);
    const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, inputDataFieldName);

    const fileName = fileNameOverride || binaryData.fileName || 'file';
    const mimeType = binaryData.mimeType ?? 'application/octet-stream';
    const boundary = `----n8nDingtalkMedia${Date.now().toString(16)}${Math.random()
      .toString(16)
      .slice(2, 10)}`;

    const body = buildMultipartBody({ boundary, mediaType, fileName, mimeType, file: buffer });

    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/media/upload',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
      json: false,
    });

    // json:false 时响应可能以字符串返回，这里统一解析并校验 errcode
    let out: IDataObject;
    if (typeof resp === 'string') {
      try {
        out = JSON.parse(resp) as IDataObject;
      } catch {
        throw new NodeOperationError(this.getNode(), '上传响应不是合法的 JSON', { itemIndex });
      }
    } else {
      out = resp as IDataObject;
    }

    if (out.errcode !== undefined && String(out.errcode) !== '0') {
      const errmsg =
        typeof out.errmsg === 'string' && out.errmsg ? out.errmsg : `上传失败 (errcode ${String(out.errcode)})`;
      throw new NodeOperationError(this.getNode(), errmsg, { itemIndex });
    }

    return {
      json: out,
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
