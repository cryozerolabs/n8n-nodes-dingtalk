import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';

const OP = 'robot.ding.recall';
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
    displayName: '需要被撤回的DING消息ID',
    name: 'openDingId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
];

const properties: INodeProperties[] = [
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify(
      {
        robotCode: 'ding1234567890',
        openDingId: 'ding1234567890',
      },
      null,
      2,
    ),
    jsonDescription:
      '<a href="https://open.dingtalk.com/document/orgapp/robot-withdraws-pin-message" target="_blank">查看官方API文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '💎撤回已经发送的DING消息',
  description: '[钉钉专业版]撤回使用企业机器人发送的DING消息',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const robotCode = ctx.getNodeParameter('robotCode', idx, undefined) as number;
        const openDingId = ctx.getNodeParameter('openDingId', idx, undefined) as number;

        return {
          robotCode,
          openDingId,
        } as IDataObject;
      },
    });
    const resp = await request.call(this, {
      method: 'POST',
      url: '/robot/ding/recall',
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
