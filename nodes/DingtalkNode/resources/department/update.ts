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

const OP = 'department.update';
const showOnly = { show: { operation: [OP] } };

interface DepartmentField {
  apiName: string;
  property: INodeProperties;
  commaSeparated?: boolean;
}

const updateFields: DepartmentField[] = [
  {
    apiName: 'name',
    property: { displayName: '部门名称', name: 'name', type: 'string', default: '' },
  },
  {
    apiName: 'parent_id',
    property: { displayName: '父部门 ID', name: 'parentId', type: 'string', default: '' },
  },
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
  {
    apiName: 'language',
    property: {
      displayName: '通讯录语言',
      name: 'language',
      type: 'options',
      default: 'zh_CN',
      options: [
        { name: '中文', value: 'zh_CN' },
        { name: '英文', value: 'en_US' },
      ],
    },
  },
  {
    apiName: 'auto_add_user',
    property: {
      displayName: '新成员自动加入部门群',
      name: 'autoAddUser',
      type: 'boolean',
      default: false,
    },
  },
  {
    apiName: 'dept_manager_userid_list',
    commaSeparated: true,
    property: commaSeparatedStringProperty({
      displayName: '部门主管 User ID',
      name: 'deptManagerUserIds',
      description: '主管须属于当前部门；清空时需同时选择强制更新字段中的部门主管',
    }),
  },
  {
    apiName: 'group_contain_sub_dept',
    property: {
      displayName: '部门群包含子部门',
      name: 'groupContainSubDept',
      type: 'boolean',
      default: false,
    },
  },
  {
    apiName: 'group_contain_outer_dept',
    property: {
      displayName: '部门群包含外包部门',
      name: 'groupContainOuterDept',
      type: 'boolean',
      default: false,
    },
  },
  {
    apiName: 'group_contain_hidden_dept',
    property: {
      displayName: '部门群包含隐藏部门',
      name: 'groupContainHiddenDept',
      type: 'boolean',
      default: false,
    },
  },
  {
    apiName: 'org_dept_owner',
    property: {
      displayName: '部门群群主 User ID',
      name: 'orgDeptOwner',
      type: 'string',
      default: '',
    },
  },
  {
    apiName: 'force_update_fields',
    commaSeparated: true,
    property: {
      displayName: '强制更新字段',
      name: 'forceUpdateFields',
      type: 'multiOptions',
      default: [],
      options: [{ name: '部门主管', value: 'dept_manager_userid_list' }],
      description: '所选字段为空时清空对应配置',
    },
  },
  {
    apiName: 'code',
    property: {
      displayName: '部门编码',
      name: 'code',
      type: 'string',
      default: '',
      typeOptions: { maxLength: 30 },
    },
  },
];

const properties: INodeProperties[] = [
  {
    displayName: '部门 ID',
    name: 'deptId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  ...bodyProps(showOnly, {
    defaultJsonBody: '{}',
    jsonDescription:
      '仅填写需要更新的字段，目标部门使用上方部门 ID。<a href="https://open.dingtalk.com/document/development/address-book-update-department" target="_blank">查看官方 API 文档</a>',
    formProperties: [
      {
        displayName: '更新字段',
        name: 'additionalFields',
        type: 'collection',
        default: {},
        placeholder: '添加字段',
        options: updateFields.map((field) => field.property),
        displayOptions: showOnly,
      },
    ],
  }),
];

function getDepartmentFormFields(ctx: IExecuteFunctions, itemIndex: number): IDataObject {
  const values = ctx.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
  const body: IDataObject = {};
  for (const { apiName, property, commaSeparated } of updateFields) {
    if (!Object.prototype.hasOwnProperty.call(values, property.name)) continue;
    let value = values[property.name];
    if (commaSeparated && value !== undefined && value !== null) {
      const items = Array.isArray(value) ? value : String(value).split(/[\n,，]/);
      value = items
        .map((item) => String(item).trim())
        .filter(Boolean)
        .join(',');
    }
    if (apiName === 'parent_id' && typeof value === 'string' && value.trim() !== '') {
      value = Number(value);
    }
    body[apiName] = value;
  }
  return body;
}

export function buildUpdateDepartmentBody(deptId: unknown, input: IDataObject): IDataObject {
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
  const forceFields = body.force_update_fields;
  const clearManagers =
    typeof forceFields === 'string' &&
    forceFields
      .split(',')
      .map((field) => field.trim())
      .includes('dept_manager_userid_list');
  if (clearManagers) body.dept_manager_userid_list ??= '';
  return { ...body, dept_id: Number(deptId) };
}

const op: OperationDef = {
  value: OP,
  name: '更新部门',
  description: '更新指定部门，未设置的字段保持不变',
  properties,
  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const deptId = this.getNodeParameter('deptId', itemIndex);
    const input = getBodyData(this, itemIndex, {
      formBuilder: (ctx, idx) => getDepartmentFormFields(ctx, idx),
    });
    const resp = await request.call(this, {
      method: 'POST',
      url: 'https://oapi.dingtalk.com/topapi/v2/department/update',
      body: buildUpdateDepartmentBody(deptId, input),
    });
    return { json: resp as IDataObject, pairedItem: { item: itemIndex } };
  },
};

export default op;
