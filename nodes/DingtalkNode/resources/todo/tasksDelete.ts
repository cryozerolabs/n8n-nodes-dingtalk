/* eslint-disable n8n-nodes-base/node-param-description-lowercase-first-char */
/* eslint-disable n8n-nodes-base/node-param-description-unneeded-backticks */
import { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { getOperatorId, operatorProps } from '../../../shared/properties/operator';
import { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';

const OP = 'todo.tasks.query';

// 只在当前操作显示这些参数
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  {
    displayName: '分页游标',
    name: 'nextToken',
    // eslint-disable-next-line n8n-nodes-base/node-param-type-options-password-missing
    type: 'string',
    default: '',
    displayOptions: showOnly,
    description:
      '如果一个查询条件一次无法全部返回结果，会返回分页token，下次查询带上该token后会返回后续数据，直到分页token为null表示数据已经全部查询完毕。',
  },
  {
    displayName: '待办完成状态',
    name: 'isDone',
    type: 'options',
    displayOptions: showOnly,
    default: '',
    options: [
      { name: '所有', value: '' },
      { name: '已完成', value: true },
      { name: '未完成', value: false },
    ],
  },
  {
    displayName: '查询目标用户角色类型',
    name: 'roleTypes',
    type: 'json',
    default: '[]',
    displayOptions: showOnly,
    description: `executor：执行人，creator：创建人，participant：参与人。可以同时传多个值。外层list表示或的关系，内层list表示与的关系。例如：[["executor"], ["creator"],["participant"]] 或 [["executor", "creator"]]。`,
  },
  {
    displayName: '待办的业务类型',
    name: 'todoType',
    type: 'options',
    default: '',
    options: [
      { name: '所有', value: '' },
      { name: '待办', value: 'TODO' },
      { name: '待阅', value: 'READ' },
    ],
    description:
      '待办的业务类型，目前支持两种： TODO：待办业务类型； READ：待阅业务类型。 不传该入参时，默认查询的是所有业务类型。',
    displayOptions: showOnly,
  },
];

const properties: INodeProperties[] = [
  ...operatorProps(showOnly),
  ...bodyProps(showOnly, {
    defaultMode: 'form',
    defaultJsonBody: JSON.stringify({}, null, 2),
    jsonDescription:
      '请求体JSON数据。<a href="https://open.dingtalk.com/document/orgapp/query-the-to-do-list-of-enterprise-users" target="_blank">查看官方API文档</a>',
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '查询企业下用户待办列表',
  description: '获取该授权企业下某用户的待办列表',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const operatorId = await getOperatorId(this, itemIndex);

    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const result: IDataObject = {};

        const nextToken = ctx.getNodeParameter('nextToken', idx, undefined) as string;
        const isDone = ctx.getNodeParameter('isDone', idx, undefined) as string;
        // const ctx = this.getNodeParameter('roleTypes', idx, undefined) as string;
        const todoType = ctx.getNodeParameter('todoType', idx, undefined) as string;

        if (nextToken) {
          result.nextToken = nextToken;
        }
        if (isDone !== '') {
          result.isDone = isDone;
        }
        // if (roleTypes) {
        //   body.roleTypes = roleTypes;
        // }
        if (todoType) {
          result.todoType = todoType;
        }

        return result;
      },
    });

    const resp = await request.call(this, {
      method: 'POST',
      url: `/todo/users/${operatorId}/org/tasks/query`,
      body,
    });

    const out: IDataObject = resp as unknown as IDataObject;
    return { json: out, pairedItem: { item: itemIndex } };
  },
};

export default op;
