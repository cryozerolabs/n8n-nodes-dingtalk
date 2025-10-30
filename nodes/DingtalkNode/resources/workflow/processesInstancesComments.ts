import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import { commaSeparatedStringProperty } from '../../../shared/properties/commaSeparatedString';

const OP = 'workflow.processes.instancesComments';
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  {
    displayName: '审批实例ID',
    name: 'processInstanceId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '评论的内容',
    name: 'text',
    type: 'string',
    default: '',
    displayOptions: showOnly,
  },
  {
    displayName: '评论人的userId',
    name: 'commentUserId',
    type: 'string',
    default: '',
    displayOptions: showOnly,
  },
  {
    displayName: '文件',
    name: 'file',
    type: 'collection',
    default: {},
    placeholder: '添加图片、附件',
    options: [
      commaSeparatedStringProperty({
        displayName: '图片',
        name: 'photos',
        placeholder: 'https://example.com/a.png, https://example.com/b.png',
      }),
      {
        displayName: '附件',
        name: 'attachments',
        type: 'fixedCollection',
        placeholder: '添加附件',
        default: [],
        typeOptions: {
          multipleValues: true,
          sortable: true,
        },
        options: [
          {
            displayName: '附件',
            name: 'attachment',
            description:
              '添加审批评论附件需将文件上传至审批钉盘空间，可以获取到接口参数spaceId，fileType，fileName，fileId，fileSize。<a href="https://open.dingtalk.com/document/development/obtains-the-information-about-approval-nail-disk" target="_blank">获取审批钉盘空间信息</a>',
            values: [
              {
                displayName: '钉盘空间ID',
                name: 'spaceId',
                type: 'string',
                default: '',
                required: true,
              },
              {
                displayName: '文件大小',
                name: 'fileSize',
                type: 'string',
                default: '',
                required: true,
              },
              {
                displayName: '文件ID',
                name: 'fileId',
                type: 'string',
                default: '',
                required: true,
              },
              {
                displayName: '文件名称',
                name: 'fileName',
                type: 'string',
                default: '',
                required: true,
              },
              {
                displayName: '文件类型',
                name: 'fileType',
                type: 'string',
                default: '',
                required: true,
              },
            ],
          },
        ],
      },
    ],
    displayOptions: showOnly,
  },
];

const properties: INodeProperties[] = [
  ...bodyProps(showOnly, {
    defaultJsonBody: JSON.stringify(
      {
        processInstanceId: 'a171de6c-8bxxxx',
        text: '同意。',
        commentUserId: 'user123',
        file: {
          photos: ['https://url1'],
          attachments: [
            {
              spaceId: '123',
              fileSize: '1024',
              fileId: 'B1oQixxxx',
              fileName: '文件名称。',
              fileType: 'file',
            },
          ],
        },
      },
      null,
      2,
    ),
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '添加审批评论',
  description: '对审批实例添加评论',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const processInstanceId = ctx.getNodeParameter(
          'processInstanceId',
          idx,
          undefined,
        ) as number;
        const text = ctx.getNodeParameter('text', idx, undefined) as string;
        const commentUserId = ctx.getNodeParameter('commentUserId', idx, undefined) as string;
        const file = ctx.getNodeParameter('file', idx, undefined) as IDataObject;

        const result: IDataObject = {
          processInstanceId,
          text,
          commentUserId,
        };

        if (file) {
          // 格式化photos参数
          if (file.photos) {
            file.photos = (file.photos as string)
              .trim()
              .split(/[\n,，]/)
              .map((value) => value.trim())
              .filter((value) => value.length > 0);
          }
          result.file = file;
        }

        return result;
      },
    });
    const resp = await request.call(this, {
      method: 'POST',
      url: '/workflow/processInstances/comments',
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
