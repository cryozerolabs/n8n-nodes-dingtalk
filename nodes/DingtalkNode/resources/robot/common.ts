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
 * 消息类型与 msgParam 格式对齐官方文档「机器人发送消息的类型」：
 * https://open.dingtalk.com/document/development/robot-message-type
 */

/** 消息类型选项，与钉钉官方 sample* 模板对应，custom 允许直填任意 msgKey */
const MESSAGE_TYPE_OPTIONS = [
  { name: '文本类型消息', value: 'text' },
  { name: '链接类型消息', value: 'link' },
  { name: 'Markdown类型消息', value: 'markdown' },
  { name: '图片类型消息', value: 'image' },
  { name: 'ActionCard类型消息', value: 'actionCard' },
  { name: '语音类型消息', value: 'audio' },
  { name: '文件类型消息', value: 'file' },
  { name: '视频类型消息', value: 'video' },
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

    // image
    {
      displayName: '图片地址',
      name: 'photoURL',
      type: 'string',
      default: '',
      required: true,
      placeholder: '@lADOABQ5xxxxx',
      displayOptions: showFor(operationFilter, { msgtype: ['image'] }),
      description:
        '图片的完整URL路径，或图片的mediaId（可通过「上传媒体文件」操作获取，支持jpg、gif、png、bmp，最大20MB）',
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
        { name: '整体跳转（单个按钮）', value: 'single' },
        { name: '竖排多按钮（2-5个）', value: 'vertical' },
        { name: '横排双按钮', value: 'horizontal' },
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
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'], btns: ['vertical'] }),
      description: '竖排按钮，数量需在2到5个之间（对应msgKey sampleActionCard2~sampleActionCard5）',
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
    {
      displayName: '按钮1标题',
      name: 'buttonTitle1',
      type: 'string',
      default: '',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'], btns: ['horizontal'] }),
    },
    {
      displayName: '按钮1跳转链接',
      name: 'buttonUrl1',
      type: 'string',
      default: '',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'], btns: ['horizontal'] }),
    },
    {
      displayName: '按钮2标题',
      name: 'buttonTitle2',
      type: 'string',
      default: '',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'], btns: ['horizontal'] }),
    },
    {
      displayName: '按钮2跳转链接',
      name: 'buttonUrl2',
      type: 'string',
      default: '',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['actionCard'], btns: ['horizontal'] }),
    },

    // audio
    {
      displayName: '语音mediaId',
      name: 'mediaId',
      type: 'string',
      default: '',
      required: true,
      placeholder: '@IR_Pxxxxxxxx',
      displayOptions: showFor(operationFilter, { msgtype: ['audio'] }),
      description:
        '语音文件的mediaId，可通过「上传媒体文件」操作获取，支持ogg、amr格式，最大2MB',
    },
    {
      displayName: '语音时长(毫秒)',
      name: 'duration',
      type: 'number',
      typeOptions: { integerValue: true },
      default: 1000,
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['audio'] }),
    },

    // file
    {
      displayName: '文件mediaId',
      name: 'mediaId',
      type: 'string',
      default: '',
      required: true,
      placeholder: '@lAzPxxxxxxxx',
      displayOptions: showFor(operationFilter, { msgtype: ['file'] }),
      description: '文件的mediaId，可通过「上传媒体文件」操作获取',
    },
    {
      displayName: '文件名称',
      name: 'fileName',
      type: 'string',
      default: '',
      required: true,
      placeholder: '表格.xlsx',
      displayOptions: showFor(operationFilter, { msgtype: ['file'] }),
    },
    {
      displayName: '文件类型',
      name: 'fileType',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'xlsx',
      displayOptions: showFor(operationFilter, { msgtype: ['file'] }),
      description: '支持 xlsx、pdf、zip、rar、doc、docx',
    },

    // video
    {
      displayName: '视频mediaId',
      name: 'videoMediaId',
      type: 'string',
      default: '',
      required: true,
      placeholder: '$iQELxxxxxxxx',
      displayOptions: showFor(operationFilter, { msgtype: ['video'] }),
      description: '视频文件的mediaId，可通过「上传媒体文件」操作获取，仅支持mp4，最大20MB',
    },
    {
      displayName: '视频时长(秒)',
      name: 'duration',
      type: 'number',
      typeOptions: { integerValue: true },
      default: 1,
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['video'] }),
    },
    {
      displayName: '视频类型',
      name: 'videoType',
      type: 'string',
      default: 'mp4',
      required: true,
      displayOptions: showFor(operationFilter, { msgtype: ['video'] }),
      description: '目前仅支持 mp4',
    },
    {
      displayName: '封面图mediaId',
      name: 'picMediaId',
      type: 'string',
      default: '',
      placeholder: '$igExxxxxxxx',
      displayOptions: showFor(operationFilter, { msgtype: ['video'] }),
      description: '视频封面图的mediaId，可通过「上传媒体文件」操作获取，留空则不设置封面',
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
  photoURL?: string;
  btns?: string;
  singleTitle?: string;
  singleURL?: string;
  buttons?: IDataObject;
  buttonTitle1?: string;
  buttonUrl1?: string;
  buttonTitle2?: string;
  buttonUrl2?: string;
  mediaId?: string;
  duration?: number | string;
  fileName?: string;
  fileType?: string;
  videoMediaId?: string;
  videoType?: string;
  picMediaId?: string;
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
  } else if (msgtype === 'image') {
    msgKey = 'sampleImageMsg';
    msgParam = { photoURL: values.photoURL ?? '' };
  } else if (msgtype === 'actionCard') {
    msgParam = { title: values.title ?? '', text: values.text ?? '' };

    if (values.btns !== 'vertical' && values.btns !== 'horizontal') {
      // 整体跳转：单按钮
      msgKey = 'sampleActionCard';
      msgParam.singleTitle = values.singleTitle ?? '';
      msgParam.singleURL = values.singleURL ?? '';
    } else if (values.btns === 'vertical') {
      // 竖排多按钮：按钮数量决定 msgKey（sampleActionCard2 ~ sampleActionCard5）
      const buttons = (values.buttons?.button as IDataObject[] | undefined) ?? [];
      msgKey = `sampleActionCard${Math.max(2, Math.min(buttons.length, 5))}`;
      buttons.forEach((button, index) => {
        const no = index + 1;
        msgParam[`actionTitle${no}`] = (button.title as string) ?? '';
        msgParam[`actionURL${no}`] = (button.actionURL as string) ?? '';
      });
    } else {
      // 横排双按钮
      msgKey = 'sampleActionCard6';
      msgParam.buttonTitle1 = values.buttonTitle1 ?? '';
      msgParam.buttonUrl1 = values.buttonUrl1 ?? '';
      msgParam.buttonTitle2 = values.buttonTitle2 ?? '';
      msgParam.buttonUrl2 = values.buttonUrl2 ?? '';
    }
  } else if (msgtype === 'audio') {
    msgKey = 'sampleAudio';
    msgParam = { mediaId: values.mediaId ?? '', duration: String(values.duration ?? '') };
  } else if (msgtype === 'file') {
    msgKey = 'sampleFile';
    msgParam = {
      mediaId: values.mediaId ?? '',
      fileName: values.fileName ?? '',
      fileType: values.fileType ?? '',
    };
  } else if (msgtype === 'video') {
    msgKey = 'sampleVideo';
    msgParam = {
      duration: String(values.duration ?? ''),
      videoMediaId: values.videoMediaId ?? '',
      videoType: values.videoType || 'mp4',
    };
    if (values.picMediaId) {
      msgParam.picMediaId = values.picMediaId;
    }
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
  const btns = ctx.getNodeParameter('btns', itemIndex, 'single') as string;
  const buttons = ctx.getNodeParameter('buttons', itemIndex, {}) as IDataObject;

  if (msgtype === 'actionCard' && btns === 'vertical') {
    const buttonList = (buttons.button as IDataObject[] | undefined) ?? [];
    if (buttonList.length < 2 || buttonList.length > 5) {
      throw new NodeOperationError(ctx.getNode(), '竖排多按钮需要2到5个按钮', { itemIndex });
    }
  }

  return {
    msgtype,
    content: ctx.getNodeParameter('content', itemIndex, '') as string,
    title: ctx.getNodeParameter('title', itemIndex, '') as string,
    text: ctx.getNodeParameter('text', itemIndex, '') as string,
    messageUrl: ctx.getNodeParameter('messageUrl', itemIndex, '') as string,
    picUrl: ctx.getNodeParameter('picUrl', itemIndex, '') as string,
    photoURL: ctx.getNodeParameter('photoURL', itemIndex, '') as string,
    btns,
    singleTitle: ctx.getNodeParameter('singleTitle', itemIndex, '') as string,
    singleURL: ctx.getNodeParameter('singleURL', itemIndex, '') as string,
    buttons,
    buttonTitle1: ctx.getNodeParameter('buttonTitle1', itemIndex, '') as string,
    buttonUrl1: ctx.getNodeParameter('buttonUrl1', itemIndex, '') as string,
    buttonTitle2: ctx.getNodeParameter('buttonTitle2', itemIndex, '') as string,
    buttonUrl2: ctx.getNodeParameter('buttonUrl2', itemIndex, '') as string,
    mediaId: ctx.getNodeParameter('mediaId', itemIndex, '') as string,
    duration: ctx.getNodeParameter('duration', itemIndex, 0) as number,
    fileName: ctx.getNodeParameter('fileName', itemIndex, '') as string,
    fileType: ctx.getNodeParameter('fileType', itemIndex, '') as string,
    videoMediaId: ctx.getNodeParameter('videoMediaId', itemIndex, '') as string,
    videoType: ctx.getNodeParameter('videoType', itemIndex, 'mp4') as string,
    picMediaId: ctx.getNodeParameter('picMediaId', itemIndex, '') as string,
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
