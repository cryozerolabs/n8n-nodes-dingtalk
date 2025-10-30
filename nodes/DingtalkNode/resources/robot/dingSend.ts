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

const OP = 'robot.ding.send';
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  {
    displayName: '发DING消息的机器人ID',
    name: 'robotCode',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: 'DING消息类型',
    name: 'remindType',
    type: 'options',
    default: 1,
    options: [
      { name: '应用内DING', value: 1 },
      { name: '短信DING', value: 2 },
      { name: '电话DING', value: 3 },
    ],
    description:
      '短信 DING 和电话 DING 需要单独购买权益包。本接口在没有购买短信 DING 和电话 DING的情况下，仅支持发送应用内 DING。DING消息类型：1: 应用内DING; 2: 短信DING; 3: 电话DING。',
    displayOptions: showOnly,
  },
  commaSeparatedStringProperty({
    displayName: '接收人userId列表',
    name: 'receiverUserIdList',
    required: true,
    displayOptions: showOnly,
  }),
  {
    displayName: '消息内容',
    name: 'content',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '电话音色',
    name: 'callVoice',
    type: 'options',
    default: 'Standard_Female_Voice',
    options: [
      { name: '标准女性音色', value: 'Standard_Female_Voice' },
      { name: '粤语女性音色', value: 'Cantonese_Female_Voice' },
      { name: '温柔女性音色', value: 'Gentine_Female_Voice' },
      { name: '强势女性音色', value: 'Overbearing_Female_Voice' },
      { name: '可爱女孩音色', value: 'Lovely_Girl_Voice' },
      { name: '标准男性音色', value: 'Standard_Male_Voice' },
    ],
    displayOptions: {
      show: {
        remindType: [3],
      },
    },
  },
];

const properties: INodeProperties[] = [
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        robotCode: 'ding1234567890',
        remindType: 1,
        receiverUserIdList: ['1234567890'],
        content: 'Hello, world!',
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
  name: '💎发送DING消息',
  description: '[钉钉专业版]使用企业内机器人发送DING消息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const robotCode = ctx.getNodeParameter('robotCode', idx, undefined) as number;
        const remindType = ctx.getNodeParameter('remindType', idx, undefined) as number;

        const receiverUserIdList = getCommaSeparatedValues(ctx, idx, 'receiverUserIdList');
        const content = ctx.getNodeParameter('content', idx, undefined) as string;

        const body: IDataObject = {
          robotCode,
          remindType,
          receiverUserIdList,
          content,
        };

        if (remindType === 3) {
          const callVoice = ctx.getNodeParameter('callVoice', idx, undefined) as string;
          body.callVoice = callVoice;
        }

        return body;
      },
    });
    const resp = await request.call(this, {
      method: 'POST',
      url: '/robot/ding/send',
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
