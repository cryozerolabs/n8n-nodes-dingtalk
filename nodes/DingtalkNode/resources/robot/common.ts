import type {
  IExecuteFunctions,
  INodeProperties,
  IDataObject,
  IDisplayOptions,
  INode,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/**
 * 机器人消息表单字段与 msgKey/msgParam 构建的共享逻辑。
 * 供 robot.oto.batchSend（批量单聊）与 robot.group.send（群聊）两个操作复用。
 */

/** 消息类型选项，前五个对应钉钉官方 sample* 模板，custom 允许直填任意 msgKey */
const MESSAGE_TYPE_OPTIONS = [
  { name: '文本类型消息', value: 'text' },
  { name: '链接类型消息', value: 'link' },
  { name: 'Markdown类型消息', value: 'markdown' },
  { name: 'ActionCard类型消息', value: 'actionCard' },
  { name: 'FeedCard类型消息', value: 'feedCard' },
  { name: '自定义消息类型', value: 'custom' },
];

function showFor(
  operationFilter: Record<string, string[]>,
  extraConditions?: Record<string, string[]>,
): IDisplayOptions {
  return extraConditions
    ? { show: { ...operationFilter, ...extraConditions } }
    : { show: { ...operationFilter } };
}

/** 机器人编码（RobotCode）字段 */
export function robotCodeProperty(operationFilter: Record<string, string[]>): INodeProperties {
  return {
    displayName: '机器人ID',
    name: 'robotCode',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showFor(operationFilter),
    description: '机器人的编码（RobotCode）',
  };
}

/** 消息类型选择器 + 各消息类型的表单字段 */
export function robotMessageFormProperties(
  operationFilter: Record<string, string[]>,
): INodeProperties[] {
  return [
    {
      displayName: '消息类型',
      name: 'msgtype',
      type: 'options',
      default: 'text',
      options: MESSAGE_TYPE_OPTIONS,
      displayOptions: showFor(operationFilter),
    },

    // custom
    {
      displayName: '自定义消息模板Key',
      name: 'customMsgKey',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'sampleText',
      displayOptions: showFor(operationFilter, { msgtype: ['custom'] }),
      description: '官方消息模板的msgKey，如 sampleText、sampleMarkdown',
    },
    {
      displayName: '自定义消息参数',
      name: 'customMsgParam',
      type: 'json',
      default: '{"content":"hello text"}',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['custom'] }),
      description: '消息参数，JSON对象，将序列化为msgParam发送',
    },

    // text
    {
      displayName: '文本消息的内容',
      name: 'content',
      type: 'string',
      default: '',
      required: true,
      description: '文本消息的内容。',
      displayOptions: showFor(operationFilter, { msgtype: ['text'] }),
    },

    // link
    {
      displayName: '链接消息标题',
      name: 'title',
      type: 'string',
      default: '',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['link'] }),
    },
    {
      displayName: '链接消息的内容',
      name: 'text',
      type: 'string',
      required: true,
      default: '',
      displayOptions: showFor(operationFilter, { msgtype: ['link'] }),
      description: '如果太长只会部分展示',
    },
    {
      displayName: '点击消息跳转的URL',
      name: 'messageUrl',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'https://www.dingtalk.com',
      displayOptions: showFor(operationFilter, { msgtype: ['link'] }),
    },
    {
      displayName: '链接消息内的图片地址',
      name: 'picUrl',
      type: 'string',
      default: '',
      placeholder: '@aubHxxxxx',
      description:
        "建议使用<a href='https://open.dingtalk.com/document/development/upload-media-files' target='_blank'>上传媒体文件接口</a>获取。",
      displayOptions: showFor(operationFilter, { msgtype: ['link'] }),
    },

    // markdown
    {
      displayName: '首屏会话透出的展示内容',
      name: 'title',
      type: 'string',
      default: '',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['markdown'] }),
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
      displayOptions: showFor(operationFilter, { msgtype: ['markdown'] }),
    },

    // actionCard
    {
      displayName: '首屏会话透出的展示内容',
      name: 'title',
      type: 'string',
      default: '',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'] }),
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
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'] }),
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
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'] }),
    },
    {
      displayName: '单个按钮的标题',
      name: 'singleTitle',
      type: 'string',
      default: '',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'], btns: ['single'] }),
    },
    {
      displayName: '点击消息跳转的URL',
      name: 'singleURL',
      type: 'string',
      default: '',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'], btns: ['single'] }),
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
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'], btns: ['btns'] }),
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
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'], btns: ['btns'] }),
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
      displayOptions: showFor(operationFilter, { msgtype: ['feedCard'] }),
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
}

/** 消息类型表单的原始值（customMsgParam 须为已解析的 JSON 对象） */
export interface RobotMessageFormValues {
  msgtype: string;
  content?: string;
  title?: string;
  text?: string;
  messageUrl?: string;
  picUrl?: string;
  btns?: string;
  singleTitle?: string;
  singleURL?: string;
  btnOrientation?: number | string;
  buttons?: IDataObject;
  links?: IDataObject;
  customMsgKey?: string;
  customMsgParam?: IDataObject;
}

/**
 * 解析自定义消息参数：接受 JSON 对象或 JSON 字符串，非法输入抛出节点错误
 */
export function parseCustomMsgParam(
  raw: unknown,
  node: INode,
  itemIndex: number,
): IDataObject {
  let value: unknown = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      throw new NodeOperationError(node, '自定义消息参数不是合法的 JSON 字符串', { itemIndex });
    }
  }
  if (typeof value !== 'object' || value === null) {
    throw new NodeOperationError(node, '自定义消息参数必须为 JSON 对象', { itemIndex });
  }
  return value as IDataObject;
}

/**
 * 根据消息类型表单值构建钉钉机器人消息的 msgKey 与 msgParam
 */
export function buildMsgKeyAndParam(values: RobotMessageFormValues): {
  msgKey: string;
  msgParam: string;
} {
  const msgtype = values.msgtype ?? 'text';

  let msgKey = '';
  let msgParam: IDataObject = {};

  if (msgtype === 'text') {
    msgKey = 'sampleText';
    msgParam = { content: values.content ?? '' };
  } else if (msgtype === 'markdown') {
    msgKey = 'sampleMarkdown';
    msgParam = { title: values.title ?? '', text: values.text ?? '' };
  } else if (msgtype === 'link') {
    msgKey = 'sampleLink';
    msgParam = {
      messageUrl: values.messageUrl ?? '',
      title: values.title ?? '',
      text: values.text ?? '',
      picUrl: values.picUrl ?? '',
    };
  } else if (msgtype === 'actionCard') {
    msgKey = 'sampleActionCard';
    msgParam = { title: values.title ?? '', text: values.text ?? '' };

    if (values.btns !== 'btns') {
      msgParam.singleTitle = values.singleTitle ?? '';
      msgParam.singleURL = values.singleURL ?? '';
    } else {
      msgParam.btnOrientation = String(values.btnOrientation ?? 1);
      msgParam.btns = values.buttons?.button as IDataObject[];
    }
  } else if (msgtype === 'feedCard') {
    msgKey = 'sampleFeedCard';
    msgParam = { links: values.links?.link as IDataObject[] };
  } else if (msgtype === 'custom') {
    msgKey = String(values.customMsgKey ?? '');
    msgParam = { ...(values.customMsgParam ?? {}) };
  }

  return { msgKey, msgParam: JSON.stringify(msgParam) };
}

/** 从执行上下文读取消息类型相关表单值 */
export function collectMessageFormValues(
  ctx: IExecuteFunctions,
  itemIndex: number,
): RobotMessageFormValues {
  const msgtype = ctx.getNodeParameter('msgtype', itemIndex, 'text') as string;

  return {
    msgtype,
    content: ctx.getNodeParameter('content', itemIndex, '') as string,
    title: ctx.getNodeParameter('title', itemIndex, '') as string,
    text: ctx.getNodeParameter('text', itemIndex, '') as string,
    messageUrl: ctx.getNodeParameter('messageUrl', itemIndex, '') as string,
    picUrl: ctx.getNodeParameter('picUrl', itemIndex, '') as string,
    btns: ctx.getNodeParameter('btns', itemIndex, 'single') as string,
    singleTitle: ctx.getNodeParameter('singleTitle', itemIndex, '') as string,
    singleURL: ctx.getNodeParameter('singleURL', itemIndex, '') as string,
    btnOrientation: ctx.getNodeParameter('btnOrientation', itemIndex, 1) as number,
    buttons: ctx.getNodeParameter('buttons', itemIndex, {}) as IDataObject,
    links: ctx.getNodeParameter('links', itemIndex, {}) as IDataObject,
    customMsgKey: ctx.getNodeParameter('customMsgKey', itemIndex, '') as string,
    customMsgParam:
      msgtype === 'custom'
        ? parseCustomMsgParam(
            ctx.getNodeParameter('customMsgParam', itemIndex, undefined),
            ctx.getNode(),
            itemIndex,
          )
        : undefined,
  };
}
