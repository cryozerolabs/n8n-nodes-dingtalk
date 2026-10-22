import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import {
  robotCodeProperty,
  robotMessageFormProperties,
  buildMsgKeyAndParam,
  collectMessageFormValues,
} from './common';

const OP = 'robot.group.send';
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  robotCodeProperty({ operation: [OP] }),
  {
    displayName: '群会话ID',
    name: 'openConversationId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
    placeholder: 'cidXXXXXXXXXXXXXXXX==',
    description: '群的会话ID（openConversationId），可通过开放接口或事件订阅推送获取',
  },
  {
    displayName: '群酷应用编码',
    name: 'coolAppCode',
    type: 'string',
    default: '',
    displayOptions: showOnly,
    description: '机器人以酷应用方式安装到群时需要传入，普通群机器人可留空',
  },
  ...robotMessageFormProperties({ operation: [OP] }),
];

const properties: INodeProperties[] = [
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        robotCode: 'ding1234567890',
        openConversationId: 'cidXXXXXXXXXXXXXXXX==',
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
      '<a href="https://open.dingtalk.com/document/development/the-robot-sends-a-group-message" target="_blank">查看官方API文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '机器人发送群聊消息',
  description: '企业内部机器人向指定群会话发送消息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const robotCode = ctx.getNodeParameter('robotCode', idx, undefined) as string;
        const openConversationId = ctx.getNodeParameter(
          'openConversationId',
          idx,
          undefined,
        ) as string;
        const coolAppCode = ctx.getNodeParameter('coolAppCode', idx, '') as string;
        const { msgKey, msgParam } = buildMsgKeyAndParam(collectMessageFormValues(ctx, idx));

        const body: IDataObject = {
          robotCode,
          openConversationId,
          msgKey,
          msgParam,
        };
        if (coolAppCode) {
          body.coolAppCode = coolAppCode;
        }
        return body;
      },
    });

    const resp = await request.call(this, {
      method: 'POST',
      url: '/robot/groupMessages/send',
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
