import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import {
  commaSeparatedStringProperty,
  getCommaSeparatedValues,
} from '../../../shared/properties/commaSeparatedString';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import { request } from '../../../shared/request';

const OP = 'robot.send';
const showOnly = { show: { operation: [OP] } };

/**
 * 1. at人的规则
 * 1.1 isAtAll为true时，atMobiles和atUserIds则会被忽略
 * 1.2 isAtAll为false时，
 * 1.2.1 如果内容中有@人， 那么atMobiles和atUserIds将会填充对应的人，如果不给则不填充
 * 1.2.2 如果内容中没有@人， 那么atMobiles和atUserIds将会追加到末尾
 */

const formProperties: INodeProperties[] = [
  {
    displayName: '消息类型',
    name: 'msgtype',
    type: 'options',
    default: 'text',
    description:
      '自定义机器人可发送的消息类型参见<a href="https://open.dingtalk.com/document/dingstart/custom-bot-send-message-type#" target="_blank">自定义机器人发送消息的消息类型</a>。',
    // eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
    options: [
      { name: '文本类型消息', value: 'text' },
      { name: '链接类型消息', value: 'link' },
      { name: 'Markdown类型消息', value: 'markdown' },
      { name: 'ActionCard类型消息', value: 'actionCard' },
      { name: 'FeedCard类型消息', value: 'feedCard' },
    ],
    displayOptions: showOnly,
  },

  // 文本消息
  {
    displayName: '文本消息的内容',
    name: 'content',
    type: 'string',
    default: '',
    required: true,
    description: '文本消息的内容。',
    displayOptions: {
      show: {
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
    description: '如果需要实现 @ 功能 ，在 text 内容中添加 @ 用户的 userId。例如：@manager7675',
    displayOptions: {
      show: {
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
    description: '如果需要实现 @ 功能 ，在 text 内容中添加 @ 用户的 userId。例如：@manager7675',
    displayOptions: {
      show: {
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
    typeOptions: {
      multipleValues: true,
      multipleValueButtonText: '添加按钮',
      sortable: true,
    },
    displayOptions: {
      show: {
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
    typeOptions: {
      multipleValues: true,
      multipleValueButtonText: '添加链接',
      sortable: true,
    },
    displayOptions: {
      show: {
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

  // at
  {
    displayName: '是否@所有人',
    name: 'isAtAll',
    type: 'boolean',
    default: false,
    displayOptions: {
      show: {
        msgtype: ['text', 'markdown', 'actionCard'],
      },
    },
  },
  commaSeparatedStringProperty({
    displayName: '被@的群成员手机号',
    name: 'atMobiles',
    placeholder: '15xxx,18xxx',
    displayOptions: {
      show: {
        isAtAll: [false],
        msgtype: ['text', 'markdown', 'actionCard'],
      },
    },
    description: '在消息内容里添加@的人的手机号',
  }),
  commaSeparatedStringProperty({
    displayName: '被@被@的群成员userId',
    name: 'atUserIds',
    placeholder: 'user001,user002',
    displayOptions: {
      show: {
        isAtAll: [false],
        msgtype: ['text', 'markdown', 'actionCard'],
      },
    },
    description: '在消息内容里添加@的人的userId',
  }),
];

const properties: INodeProperties[] = [
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        at: {
          atMobiles: ['180xxxxxx'],
          atUserIds: ['user123'],
          isAtAll: false,
        },
        text: {
          content: '我就是我, @user123 是不一样的烟火',
        },
        msgtype: 'text',
      },
      null,
      2,
    ),
    jsonDescription:
      '<a href="https://open.dingtalk.com/document/development/custom-robots-send-group-messages" target="_blank">查看官方API文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '自定义机器人发送群消息',
  description: '使用自定义机器人发送群消息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const msgtype = ctx.getNodeParameter('msgtype', idx, 'text') as string;

        // 处理通用的payload
        const payload: IDataObject = {
          msgtype,
        };

        // 处理特定消息类型的payload
        // 只有text, markdown, actionCard类型才需要isAtAll、atMobiles、atUserIds
        if (['text', 'markdown', 'actionCard'].includes(msgtype)) {
          const isAtAll = ctx.getNodeParameter('isAtAll', idx, false) as boolean;

          const at: IDataObject = {
            isAtAll,
          };
          if (!isAtAll) {
            const atMobiles = getCommaSeparatedValues(ctx, idx, 'atMobiles');
            const atUserIds = getCommaSeparatedValues(ctx, idx, 'atUserIds');

            at.atMobiles = atMobiles;
            at.atUserIds = atUserIds;
          }

          payload.at = at;
        }

        if (msgtype === 'text') {
          // 处理text类型
          const content = ctx.getNodeParameter('content', idx, '') as string;
          payload.text = { content };
        } else if (msgtype === 'link') {
          // 处理link类型
          const messageUrl = ctx.getNodeParameter('messageUrl', idx, '') as string;
          const title = ctx.getNodeParameter('title', idx, '') as string;
          const picUrl = ctx.getNodeParameter('picUrl', idx, '') as string;
          const text = ctx.getNodeParameter('text', idx, '') as string;

          const link: IDataObject = {
            messageUrl,
            title,
            text,
          };

          if (picUrl) {
            link.picUrl = picUrl;
          }
          payload.link = link;
        } else if (msgtype === 'markdown') {
          const title = ctx.getNodeParameter('title', idx, '') as string;
          const text = ctx.getNodeParameter('text', idx, '') as string;

          payload.markdown = {
            title,
            text,
          };
        } else if (msgtype === 'actionCard') {
          // 处理actionCard类型
          const title = ctx.getNodeParameter('title', idx, '') as string;
          const text = ctx.getNodeParameter('text', idx, '') as string;
          const btnsMode = ctx.getNodeParameter('btns', idx, 'single') as string;

          const actionCard: IDataObject = {
            title,
            text,
          };

          if (btnsMode === 'single') {
            // 整体跳转
            actionCard.singleTitle = ctx.getNodeParameter('singleTitle', idx, '') as string;
            actionCard.singleURL = ctx.getNodeParameter('singleURL', idx, '') as string;
          } else {
            // 单独跳转
            actionCard.btnOrientation = ctx.getNodeParameter('btnOrientation', idx, 1) as number;
            const buttons = ctx.getNodeParameter('buttons', idx, []) as IDataObject;
            actionCard.btns = buttons.button as IDataObject[];
          }

          payload.actionCard = actionCard;
        } else if (msgtype === 'feedCard') {
          // 处理feedCard类型
          const links = ctx.getNodeParameter('links', idx, []) as IDataObject;
          payload.feedCard = {
            links: links.link as IDataObject[],
          };
        }
        ctx.logger.debug('payload', payload);
        return payload;
      },
    });

    const resp = await request.call(
      this,
      {
        method: 'POST',
        url: 'https://oapi.dingtalk.com/robot/send',
        body,
      },
      {
        credentialType: 'dingtalkRobotApi',
        supportsTokenRefresh: false,
      },
    );

    const out: IDataObject = resp as unknown as IDataObject;
    return {
      json: out,
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
