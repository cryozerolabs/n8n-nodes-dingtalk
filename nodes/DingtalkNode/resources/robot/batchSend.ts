import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import {
  commaSeparatedStringProperty,
  getCommaSeparatedValues,
} from '../../../shared/properties/commaSeparatedString';
import { bodyProps, getBodyData } from '../../../shared/properties/body';

const OP = 'robot.oto.batchSend';
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  {
    displayName: '机器人ID',
    name: 'robotCode',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
    description: '机器人的编码（RobotCode）',
  },
  commaSeparatedStringProperty({
    displayName: '接收人userId列表',
    name: 'userIds',
    required: true,
    displayOptions: showOnly,
    placeholder: 'user001,user002',
    description: '接收机器人消息的用户的userId列表，每次最多传20个',
  }),
  {
    displayName: '消息类型',
    name: 'msgtype',
    type: 'options',
    default: 'text',
    options: [
      { name: '文本类型消息', value: 'text' },
      { name: '链接类型消息', value: 'link' },
      { name: 'Markdown类型消息', value: 'markdown' },
      { name: 'ActionCard类型消息', value: 'actionCard' },
      { name: 'FeedCard类型消息', value: 'feedCard' },
    ],
    displayOptions: showOnly,
  },
  {
    displayName: '消息参数',
    name: 'msgParam',
    type: 'json',
    default: JSON.stringify(
      {
        text: 'hello text',
        title: 'hello title',
      },
      null,
      2,
    ),
    required: true,
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['custom'],
      },
    },
    description: '消息参数，JSON格式字符串',
  },

  // text
  {
    displayName: '文本消息的内容',
    name: 'content',
    type: 'string',
    default: '',
    required: true,
    description: '文本消息的内容。',
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['text'],
      },
    },
  },

  // link
  {
    displayName: '链接消息标题',
    name: 'title',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['link'],
      },
    },
  },
  {
    displayName: '链接消息的内容',
    name: 'text',
    type: 'string',
    required: true,
    default: '',
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['link'],
      },
    },
    description: '如果太长只会部分展示',
  },
  {
    displayName: '点击消息跳转的URL',
    name: 'messageUrl',
    type: 'string',
    default: '',
    required: true,
    placeholder: 'https://www.dingtalk.com',
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['link'],
      },
    },
  },
  {
    displayName: '链接消息内的图片地址',
    name: 'picUrl',
    type: 'string',
    default: '',
    placeholder: '@aubHxxxxx',
    description:
      "建议使用<a href='https://open.dingtalk.com/document/development/upload-media-files' target='_blank'>上传媒体文件接口</a>获取。",
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['link'],
      },
    },
  },

  // markdown
  {
    displayName: '首屏会话透出的展示内容',
    name: 'title',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['markdown'],
      },
    },
  },
  {
    displayName: 'Markdown格式的消息',
    name: 'text',
    type: 'string',
    default: '',
    required: true,
    typeOptions: {
      editor: 'htmlEditor',
    },
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['markdown'],
      },
    },
  },

  // actionCard
  {
    displayName: '首屏会话透出的展示内容',
    name: 'title',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['actionCard'],
      },
    },
  },
  {
    displayName: 'Markdown格式的消息',
    name: 'text',
    type: 'string',
    default: '',
    required: true,
    typeOptions: {
      editor: 'htmlEditor',
    },
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['actionCard'],
      },
    },
  },
  {
    displayName: '卡片跳转方式',
    name: 'btns',
    type: 'options',
    default: 'single',
    required: true,
    options: [
      { name: '整体跳转', value: 'single' },
      { name: '独立跳转', value: 'btns' },
    ],
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['actionCard'],
      },
    },
  },
  {
    displayName: '单个按钮的标题',
    name: 'singleTitle',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['actionCard'],
        btns: ['single'],
      },
    },
  },
  {
    displayName: '点击消息跳转的URL',
    name: 'singleURL',
    type: 'string',
    default: '',
    required: true,
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['actionCard'],
        btns: ['single'],
      },
    },
  },
  {
    displayName: '按钮排列方式',
    name: 'btnOrientation',
    type: 'options',
    default: 1,
    options: [
      { name: '按钮竖直排列', value: 0 },
      { name: '按钮横向排列', value: 1 },
    ],
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['actionCard'],
        btns: ['btns'],
      },
    },
  },
  {
    displayName: '按钮列表',
    name: 'buttons',
    type: 'fixedCollection',
    default: {},
    placeholder: '添加按钮',
    typeOptions: {
      multipleValueButtonText: '添加按钮',
      multipleValues: true,
      sortable: true,
    },
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['actionCard'],
        btns: ['btns'],
      },
    },
    options: [
      {
        displayName: '按钮',
        name: 'button',
        values: [
          {
            displayName: '按钮标题',
            name: 'title',
            type: 'string',
            default: '',
            required: true,
            placeholder: '',
          },
          {
            displayName: '跳转链接',
            name: 'actionURL',
            type: 'string',
            default: '',
            required: true,
            placeholder: 'https://www.dingtalk.com/',
          },
        ],
      },
    ],
  },

  // feedCard
  {
    displayName: '消息链接',
    name: 'links',
    type: 'fixedCollection',
    default: {},
    placeholder: '添加链接',
    typeOptions: {
      multipleValues: true,
      multipleValueButtonText: '添加链接',
      sortable: true,
    },
    displayOptions: {
      show: {
        operation: [OP],
        msgtype: ['feedCard'],
      },
    },
    options: [
      {
        displayName: '链接',
        name: 'link',
        values: [
          {
            displayName: '文本',
            name: 'title',
            type: 'string',
            default: '',
            required: true,
          },
          {
            displayName: '跳转链接',
            name: 'messageURL',
            type: 'string',
            default: '',
            required: true,
          },
          {
            displayName: '图片的URL',
            name: 'picURL',
            type: 'string',
            default: '',
            required: true,
          },
        ],
      },
    ],
  },
];

const properties: INodeProperties[] = [
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        robotCode: 'ding1234567890',
        userIds: ['user123'],
        msgKey: 'sampleMarkdown',
        msgParam: JSON.stringify({
          text: 'hello text',
          title: 'hello title',
        }),
      },
      null,
      2,
    ),
    jsonDescription:
      '<a href="https://open.dingtalk.com/document/development/chatbots-send-one-on-one-chat-messages-in-batches" target="_blank">查看官方API文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '批量发送单聊消息',
  description: '批量发送人与机器人会话中机器人消息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const robotCode = ctx.getNodeParameter('robotCode', idx, undefined) as string;
        const userIds = getCommaSeparatedValues(ctx, idx, 'userIds');
        const msgtype = ctx.getNodeParameter('msgtype', idx, 'text') as string;

        let msgKey = '';
        let msgParam: IDataObject = {};

        if (msgtype === 'text') {
          msgKey = 'sampleText';
          const content = ctx.getNodeParameter('content', idx, '') as string;
          msgParam = { content };
        } else if (msgtype === 'markdown') {
          msgKey = 'sampleMarkdown';
          const title = ctx.getNodeParameter('title', idx, '') as string;
          const text = ctx.getNodeParameter('text', idx, '') as string;
          msgParam = { title, text };
        } else if (msgtype === 'link') {
          msgKey = 'sampleLink';
          const messageUrl = ctx.getNodeParameter('messageUrl', idx, '') as string;
          const title = ctx.getNodeParameter('title', idx, '') as string;
          const picUrl = ctx.getNodeParameter('picUrl', idx, '') as string;
          const text = ctx.getNodeParameter('text', idx, '') as string;
          msgParam = { messageUrl, title, text, picUrl };
        } else if (msgtype === 'actionCard') {
          msgKey = 'sampleActionCard';
          const title = ctx.getNodeParameter('title', idx, '') as string;
          const text = ctx.getNodeParameter('text', idx, '') as string;
          const btnsMode = ctx.getNodeParameter('btns', idx, 'single') as string;

          msgParam = { title, text };

          if (btnsMode === 'single') {
            const singleTitle = ctx.getNodeParameter('singleTitle', idx, '') as string;
            const singleURL = ctx.getNodeParameter('singleURL', idx, '') as string;
            msgParam.singleTitle = singleTitle;
            msgParam.singleURL = singleURL;
          } else {
            const btnOrientation = ctx.getNodeParameter('btnOrientation', idx, 1) as number;
            const buttons = ctx.getNodeParameter('buttons', idx, []) as IDataObject;
            msgParam.btnOrientation = btnOrientation.toString();
            msgParam.btns = buttons.button as IDataObject[];
          }
        } else if (msgtype === 'feedCard') {
          msgKey = 'sampleFeedCard';
          const links = ctx.getNodeParameter('links', idx, []) as IDataObject;
          msgParam = { links: links.link as IDataObject[] };
        }

        const body: IDataObject = {
          robotCode,
          userIds,
          msgKey,
          msgParam: JSON.stringify(msgParam),
        };
        return body;
      },
    });

    const resp = await request.call(this, {
      method: 'POST',
      url: '/robot/oToMessages/batchSend',
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
