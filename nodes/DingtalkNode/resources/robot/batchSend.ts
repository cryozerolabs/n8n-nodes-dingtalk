import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { commaSeparatedStringProperty, getCommaSeparatedValues } from '../../../shared/properties/commaSeparatedString';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import {
  robotCodeProperty,
  robotMessageFormProperties,
  buildMsgKeyAndParam,
  collectMessageFormValues,
} from './common';

const OP = 'robot.oto.batchSend';
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  robotCodeProperty({ operation: [OP] }),
  commaSeparatedStringProperty({
    displayName: '接收人userId列表',
    name: 'userIds',
    required: true,
    displayOptions: showOnly,
    placeholder: 'user001,user002',
    description: '接收机器人消息的用户的userId列表，每次最多传20个',
  }),
  ...robotMessageFormProperties({ operation: [OP] }),
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
        const { msgKey, msgParam } = buildMsgKeyAndParam(collectMessageFormValues(ctx, idx));

        const body: IDataObject = {
          robotCode,
          userIds,
          msgKey,
          msgParam,
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
