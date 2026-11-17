import type {
  IExecuteFunctions,
  IDataObject,
  INodeExecutionData,
  INodeProperties,
} from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import { commaSeparatedStringProperty } from '../../../shared/properties/commaSeparatedString';

const OP = 'department.create';
const showOnly = { show: { operation: [OP] } };

interface DepartmentField {
  apiName: string;
  property: INodeProperties;
  commaSeparated?: boolean;
}

const createFields: DepartmentField[] = [
  {
    apiName: 'hide_dept',
    property: { displayName: '隐藏部门', name: 'hideDept', type: 'boolean', default: false },
  },
  {
    apiName: 'dept_permits',
    commaSeparated: true,
    property: commaSeparatedStringProperty({
      displayName: '可查看本部门的部门 ID',
      name: 'deptPermits',
      description: '隐藏本部门时生效，多个部门 ID 用英文逗号分隔',
    }),
  },
  {
    apiName: 'user_permits',
    commaSeparated: true,
    property: commaSeparatedStringProperty({
      displayName: '可查看本部门的用户 ID',
      name: 'userPermits',
      description: '隐藏本部门时生效，多个 userId 用英文逗号分隔',
    }),
  },
  {
    apiName: 'outer_dept',
    property: {
      displayName: '限制成员查看通讯录',
      name: 'outerDept',
      type: 'boolean',
      default: false,
    },
  },
  {
    apiName: 'outer_dept_only_self',
    property: {
      displayName: '允许查看本部门及下级通讯录',
      name: 'outerDeptOnlySelf',
      type: 'boolean',
      default: false,
      description: '限制查看通讯录时生效；关闭时仅可看到自己',
    },
  },
  {
    apiName: 'outer_permit_users',
    commaSeparated: true,
    property: commaSeparatedStringProperty({
      displayName: '成员可查看的用户 ID',
      name: 'outerPermitUsers',
      description: '限制查看通讯录时生效，多个 userId 用英文逗号分隔',
    }),
  },
  {
    apiName: 'outer_permit_depts',
    commaSeparated: true,
    property: commaSeparatedStringProperty({
      displayName: '成员可查看的部门 ID',
      name: 'outerPermitDepts',
      description: '限制查看通讯录时生效，多个部门 ID 用英文逗号分隔',
    }),
  },
  {
    apiName: 'create_dept_group',
    property: {
      displayName: '创建部门群',
      name: 'createDeptGroup',
      type: 'boolean',
      default: false,
    },
  },
  {
    apiName: 'auto_approve_apply',
    property: {
      displayName: '自动同意加入部门',
      name: 'autoApproveApply',
      type: 'boolean',
      default: false,
    },
  },
  {
    apiName: 'order',
    property: { displayName: '排序值', name: 'order', type: 'number', default: 0 },
  },
  {
    apiName: 'source_identifier',
    property: {
      displayName: '外部部门标识',
      name: 'sourceIdentifier',
      type: 'string',
      default: '',
    },
  },
];

const properties: INodeProperties[] = bodyProps(showOnly, {
  defaultJsonBody: '{"name":"研发部","parent_id":1}',
  jsonDescription:
    '请求体 JSON。<a href="https://open.dingtalk.com/document/development/address-book-creation-department-established-department" target="_blank">查看官方 API 文档</a>',
  formProperties: [
    { displayName: '部门名称', name: 'name', type: 'string', default: '', required: true },
    {
      displayName: '父部门 ID',
      name: 'parentId',
      type: 'string',
      default: '1',
      required: true,
      description: '根部门 ID 为 1',
    },
    {
      displayName: '其他字段',
      name: 'additionalFields',
      type: 'collection',
      default: {},
      placeholder: '添加字段',
      options: createFields.map((field) => field.property),
      displayOptions: showOnly,
    },
  ],
});

function getDepartmentFormFields(ctx: IExecuteFunctions, itemIndex: number): IDataObject {
  const values = ctx.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
  const body: IDataObject = {};
  for (const { apiName, property, commaSeparated } of createFields) {
    if (!Object.prototype.hasOwnProperty.call(values, property.name)) continue;
    let value = values[property.name];
    if (commaSeparated && value !== undefined && value !== null) {
      const items = Array.isArray(value) ? value : String(value).split(/[\n,，]/);
      value = items
        .map((item) => String(item).trim())
        .filter(Boolean)
        .join(',');
    }
    body[apiName] = value;
  }
  return body;
}

export function buildCreateDepartmentBody(input: IDataObject): IDataObject {
  if (Array.isArray(input)) throw new Error('请求体必须为 JSON 对象');
  const body: IDataObject = { ...input };
  for (const [key, value] of Object.entries(body)) {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    )
      delete body[key];
  }
  return body;
}

const op: OperationDef = {
  value: OP,
  name: '创建部门',
  description: '创建钉钉部门',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const input = getBodyData(this, itemIndex, {
      formBuilder: (ctx, idx) => ({
        ...getDepartmentFormFields(ctx, idx),
        name: ctx.getNodeParameter('name', idx, ''),
        parent_id: Number(ctx.getNodeParameter('parentId', idx, '1')),
      }),
    });
    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/department/create',
      body: buildCreateDepartmentBody(input),
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
