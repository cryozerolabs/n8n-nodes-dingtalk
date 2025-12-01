import {
  NodeConnectionTypes,
  NodeOperationError,
  type INodeProperties,
  type INodeType,
  type INodeTypeDescription,
  type ITriggerFunctions,
  type ITriggerResponse,
} from 'n8n-workflow';
import { runStreamPushTrigger, streamPushTriggerOptions } from './triggers/streamPushTrigger';

interface TriggerDefinition {
  value: string;
  name: string;
  description: string;
  properties: INodeProperties[];
  run(this: ITriggerFunctions): Promise<ITriggerResponse | undefined>;
}

const triggerDefinitions: TriggerDefinition[] = [
  {
    value: 'stream.push',
    name: 'Stream模式事件订阅',
    description: '当钉钉通过 Stream 模式推送事件时触发。',
    properties: streamPushTriggerOptions,
    run: runStreamPushTrigger,
  },
];

const triggerMap = new Map(triggerDefinitions.map((def) => [def.value, def]));

export class DingtalkNodeTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Dingtalk Node Trigger',
    name: 'dingtalkNodeTrigger',
    icon: 'file:icon.png',
    group: ['trigger'],
    version: 1,
    description: 'Dingtalk Node Trigger',
    subtitle: '={{($parameter["event"])}}',
    defaults: {
      name: 'Dingtalk Node Trigger',
    },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    credentials: [
      {
        name: 'dingtalkApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Event',
        name: 'event',
        type: 'options',
        // eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-options
        default: 'stream.push',
        options: triggerDefinitions.map((def) => ({
          name: def.name,
          value: def.value,
          description: def.description,
        })),
      },
      ...triggerDefinitions.flatMap((def) => def.properties),
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse | undefined> {
    const event = this.getNodeParameter('event', 0) as string;
    const definition = triggerMap.get(event);
    if (!definition) {
      throw new NodeOperationError(this.getNode(), `Unsupported trigger event "${event}"`, {
        description: '请选择一个可用的触发类型。',
      });
    }

    return definition.run.call(this);
  }
}
