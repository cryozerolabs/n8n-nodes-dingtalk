const assert = require('node:assert/strict');
const test = require('node:test');
const { NodeHelpers } = require('n8n-workflow');

const { DingtalkNode } = require('../dist/nodes/DingtalkNode/DingtalkNode.node');
const department = require('../dist/nodes/DingtalkNode/resources/department').default;
const user = require('../dist/nodes/DingtalkNode/resources/user').default;
const {
  buildCreateDepartmentBody,
} = require('../dist/nodes/DingtalkNode/resources/department/create');
const {
  buildUpdateDepartmentBody,
} = require('../dist/nodes/DingtalkNode/resources/department/update');

const operations = new Map(
  [...department.operations, ...user.operations].map((op) => [op.value, op]),
);

function createContext(parameters, responses = [{ errcode: 0, errmsg: 'ok' }]) {
  const calls = [];
  return {
    calls,
    context: {
      getNodeParameter(name, itemIndex, fallback) {
        const item = Array.isArray(parameters) ? parameters[itemIndex] : parameters;
        return Object.hasOwn(item, name) ? item[name] : fallback;
      },
      getInputData: () => parameters.map(() => ({ json: {} })),
      prepareOutputData: (items) => [items],
      continueOnFail: () => false,
      getNode: () => ({
        id: 'department-test',
        name: 'DingTalk Department',
        type: 'CUSTOM.dingtalkNode',
        typeVersion: 1,
        position: [0, 0],
        parameters: {},
      }),
      getCredentials: async () => ({
        clientId: 'test-app',
        clientSecret: 'test-secret',
        accessToken: 'test-token',
      }),
      helpers: {
        async httpRequestWithAuthentication(credentialType, options) {
          calls.push({ credentialType, options });
          return responses[Math.min(calls.length - 1, responses.length - 1)];
        },
      },
      logger: { debug() {}, error() {} },
    },
  };
}

test('department operations are grouped without changing existing user or Stream operation values', () => {
  const node = new DingtalkNode();
  const resource = node.description.properties.find((p) => p.name === 'resource');
  assert.ok(resource.options.some((p) => p.value === 'department' && p.name === '部门管理'));
  assert.deepEqual(department.operations.map((op) => op.value).sort(), [
    'department.create',
    'department.delete',
    'department.get',
    'department.list',
    'department.listParentIds',
    'department.listSubIds',
    'department.search',
    'department.update',
  ]);
  assert.deepEqual(user.operations.map((op) => op.value).sort(), [
    'user.get',
    'user.getByMobile',
    'user.listDepartmentUserDetails',
    'user.listDepartmentUserIds',
    'user.listDepartmentUsers',
    'user.listLeaveRecords',
    'user.listParentDepartmentIds',
    'user.search',
  ]);
  assert.ok(
    node.description.properties.some(
      (p) => p.name === 'operation' && p.options?.some((o) => o.value === 'stream.respond'),
    ),
  );
  assert.equal(node.description.version, 1);
  for (const op of department.operations) {
    const registered = node.description.properties.filter((p) =>
      p.displayOptions?.show?.operation?.includes(op.value),
    );
    assert.ok(registered.length > 0);
    for (const p of registered) assert.deepEqual(p.displayOptions.show.resource, ['department']);
  }
});

test('required and optional parameters match the department API contracts', () => {
  const requiredNames = (value) =>
    operations
      .get(value)
      .properties.filter((p) => p.required)
      .map((p) => p.name)
      .sort();
  assert.deepEqual(requiredNames('department.create'), ['name', 'parentId']);
  assert.deepEqual(requiredNames('department.update'), ['deptId']);
  assert.deepEqual(requiredNames('department.list'), []);
  assert.deepEqual(requiredNames('department.search'), ['offset', 'queryWord', 'size']);
  assert.deepEqual(requiredNames('user.listParentDepartmentIds'), ['userId']);
  for (const value of [
    'department.delete',
    'department.get',
    'department.listSubIds',
    'department.listParentIds',
  ]) {
    assert.deepEqual(requiredNames(value), ['deptId']);
  }
  const fields = operations
    .get('department.update')
    .properties.find((p) => p.name === 'additionalFields');
  assert.equal(fields.type, 'collection');
  assert.deepEqual(fields.default, {});
  assert.ok(fields.options.every((p) => p.required !== true));
});

test('the n8n parameter resolver preserves selected collection fields without filling unselected defaults', async () => {
  const node = new DingtalkNode();
  for (const additionalFields of [{}, { name: '研发二部' }, { hideDept: false, order: 0 }]) {
    const parameters = NodeHelpers.getNodeParameters(
      node.description.properties,
      {
        resource: 'department',
        operation: 'department.update',
        deptId: '42',
        sendBody: 'form',
        additionalFields,
      },
      true,
      false,
      { typeVersion: 1 },
      node.description,
    );
    assert.deepEqual(parameters.additionalFields, additionalFields);
    const { context, calls } = createContext(parameters);
    await operations.get('department.update').run.call(context, 0);
    assert.equal(Object.hasOwn(calls[0].options.body, 'create_dept_group'), false);
    assert.equal(Object.hasOwn(calls[0].options.body, 'auto_approve_apply'), false);
  }
  const legacy = NodeHelpers.getNodeParameters(
    node.description.properties,
    { resource: 'user', operation: 'user.get', userId: 'employee-1' },
    true,
    false,
    { typeVersion: 1 },
    node.description,
  );
  assert.equal(legacy.userId, 'employee-1');
  assert.equal(legacy.operation, 'user.get');
  assert.equal(Object.hasOwn(legacy, 'additionalFields'), false);
});

const requestCases = [
  [
    'department.create',
    { name: '研发部', parentId: '1' },
    'create',
    { name: '研发部', parent_id: 1 },
    { result: { dept_id: 42 } },
  ],
  [
    'department.update',
    { deptId: '42', additionalFields: { name: '研发二部' } },
    'update',
    { dept_id: 42, name: '研发二部' },
  ],
  ['department.delete', { deptId: '42' }, 'delete', { dept_id: 42 }],
  [
    'department.get',
    { deptId: '42' },
    'get',
    { dept_id: 42, language: 'zh_CN' },
    { result: { dept_id: 42, parent_id: 1, name: '研发部' } },
  ],
  [
    'department.list',
    {},
    'listsub',
    { language: 'zh_CN' },
    { result: [{ dept_id: 42, parent_id: 1, name: '研发部' }] },
  ],
  [
    'department.listSubIds',
    { deptId: '1' },
    'listsubid',
    { dept_id: 1 },
    { result: { dept_id_list: [42, 43] } },
  ],
  [
    'department.listParentIds',
    { deptId: '42' },
    'listparentbydept',
    { dept_id: 42 },
    { result: { parent_id_list: [42, 1] } },
  ],
  [
    'user.listParentDepartmentIds',
    { userId: 'employee-1' },
    'listparentbyuser',
    { userid: 'employee-1' },
    {
      result: { parent_list: [{ parent_dept_id_list: [42, 1] }, { parent_dept_id_list: [43, 1] }] },
    },
  ],
];

for (const [value, parameters, endpoint, body, data = {}] of requestCases) {
  test(`${value} sends the official POST request and preserves response structure and item pairing`, async () => {
    const response = { errcode: 0, errmsg: 'ok', request_id: 'request-1', ...data };
    const { context, calls } = createContext(parameters, [response]);
    const result = await operations.get(value).run.call(context, 3);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].credentialType, 'dingtalkApi');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(
      calls[0].options.url,
      `https://oapi.dingtalk.com/topapi/v2/department/${endpoint}`,
    );
    assert.deepEqual(calls[0].options.body, body);
    assert.deepEqual(result, { json: response, pairedItem: { item: 3 } });
  });
}

test('search preserves the first page, requested page size, and pagination metadata', async () => {
  const response = { hasMore: true, totalCount: 12, list: [42, 43] };
  const { context, calls } = createContext({ queryWord: 'yanfa', offset: 0, size: 2 }, [response]);
  const result = await operations.get('department.search').run.call(context, 0);
  assert.equal(calls[0].options.url, '/contact/departments/search');
  assert.equal(calls[0].options.baseURL, 'https://api.dingtalk.com/v1.0');
  assert.deepEqual(calls[0].options.body, { queryWord: 'yanfa', offset: 0, size: 2 });
  assert.deepEqual(result.json, response);
});

test('listing departments omits a blank parent and supports a specified parent and language', async () => {
  for (const deptId of ['', '  ', undefined, null]) {
    const { context, calls } = createContext({ deptId });
    await operations.get('department.list').run.call(context, 0);
    assert.deepEqual(calls[0].options.body, { language: 'zh_CN' });
  }
  const { context, calls } = createContext({ deptId: '42', language: 'en_US' });
  await operations.get('department.list').run.call(context, 0);
  assert.deepEqual(calls[0].options.body, { dept_id: 42, language: 'en_US' });
});

test('creation sends only required fields until additional fields are explicitly supplied', () => {
  assert.deepEqual(buildCreateDepartmentBody({ name: '研发部', parent_id: 1 }), {
    name: '研发部',
    parent_id: 1,
  });
  assert.deepEqual(
    buildCreateDepartmentBody({
      name: '研发部',
      parent_id: 1,
      order: 0,
      hide_dept: false,
      source_identifier: ' ',
    }),
    {
      name: '研发部',
      parent_id: 1,
      order: 0,
      hide_dept: false,
    },
  );
});

test('an update omits blank values, retains explicit false and zero, and never imports create defaults', async () => {
  const { context, calls } = createContext({
    deptId: '42',
    additionalFields: {
      name: '研发二部',
      hideDept: false,
      order: 0,
      sourceIdentifier: '',
      parentId: ' ',
      deptManagerUserIds: '',
    },
  });
  await operations.get('department.update').run.call(context, 0);
  assert.deepEqual(calls[0].options.body, {
    dept_id: 42,
    name: '研发二部',
    hide_dept: false,
    order: 0,
  });
  assert.deepEqual(
    buildUpdateDepartmentBody(42, {
      name: '',
      parent_id: null,
      hide_dept: undefined,
      create_dept_group: null,
      dept_manager_userid_list: '',
    }),
    { dept_id: 42 },
  );
});

test('all explicitly selected boolean update fields retain false', async () => {
  const names = [
    'hideDept',
    'outerDept',
    'outerDeptOnlySelf',
    'createDeptGroup',
    'autoApproveApply',
    'autoAddUser',
    'groupContainSubDept',
    'groupContainOuterDept',
    'groupContainHiddenDept',
  ];
  const apiNames = [
    'hide_dept',
    'outer_dept',
    'outer_dept_only_self',
    'create_dept_group',
    'auto_approve_apply',
    'auto_add_user',
    'group_contain_sub_dept',
    'group_contain_outer_dept',
    'group_contain_hidden_dept',
  ];
  const { context, calls } = createContext({
    deptId: 42,
    additionalFields: Object.fromEntries(names.map((key) => [key, false])),
  });
  await operations.get('department.update').run.call(context, 0);
  assert.deepEqual(calls[0].options.body, {
    dept_id: 42,
    ...Object.fromEntries(apiNames.map((key) => [key, false])),
  });
});

test('clearing department managers uses the explicit force-update field', async () => {
  assert.deepEqual(buildUpdateDepartmentBody(42, { dept_manager_userid_list: '' }), {
    dept_id: 42,
  });
  assert.deepEqual(
    buildUpdateDepartmentBody(42, {
      force_update_fields: 'dept_manager_userid_list',
      dept_manager_userid_list: '',
    }),
    {
      dept_id: 42,
      force_update_fields: 'dept_manager_userid_list',
      dept_manager_userid_list: '',
    },
  );
  const { context, calls } = createContext({
    deptId: '42',
    additionalFields: { forceUpdateFields: ['dept_manager_userid_list'] },
  });
  await operations.get('department.update').run.call(context, 0);
  assert.deepEqual(calls[0].options.body, {
    dept_id: 42,
    force_update_fields: 'dept_manager_userid_list',
    dept_manager_userid_list: '',
  });
});

test('JSON and form modes produce the same update without losing explicit values', async () => {
  const body = {
    dept_id: 42,
    hide_dept: false,
    order: 0,
    parent_id: 1,
    dept_manager_userid_list: 'user1,user2',
    code: 'DEPT42',
  };
  const cases = [
    {
      deptId: '42',
      additionalFields: {
        hideDept: false,
        order: 0,
        parentId: '1',
        deptManagerUserIds: 'user1， user2',
        code: 'DEPT42',
      },
    },
    {
      deptId: '42',
      sendBody: 'json',
      jsonBody: JSON.stringify({
        hide_dept: false,
        order: 0,
        parent_id: 1,
        dept_manager_userid_list: 'user1,user2',
        code: 'DEPT42',
      }),
    },
  ];
  for (const parameters of cases) {
    const { context, calls } = createContext(parameters);
    await operations.get('department.update').run.call(context, 0);
    assert.deepEqual(calls[0].options.body, body);
  }
  const { context, calls } = createContext({
    sendBody: 'json',
    jsonBody: { name: '研发部', parent_id: 1, create_dept_group: false },
  });
  await operations.get('department.create').run.call(context, 0);
  assert.deepEqual(calls[0].options.body, {
    name: '研发部',
    parent_id: 1,
    create_dept_group: false,
  });
});

test('malformed JSON and non-object request bodies fail before making an API call', async () => {
  for (const value of ['department.create', 'department.update']) {
    for (const jsonBody of ['{', '[]', 'null']) {
      const { context, calls } = createContext({ deptId: 42, sendBody: 'json', jsonBody });
      await assert.rejects(operations.get(value).run.call(context, 0));
      assert.equal(calls.length, 0);
    }
  }
});

test('n8n reports missing required form fields through the node parameter definitions', () => {
  const node = new DingtalkNode();
  const issues = NodeHelpers.getNodeParametersIssues(
    node.description.properties,
    {
      id: 'department-test',
      name: 'DingTalk Department',
      type: 'CUSTOM.dingtalkNode',
      typeVersion: 1,
      position: [0, 0],
      parameters: {
        resource: 'department',
        operation: 'department.create',
        sendBody: 'form',
        name: '',
        parentId: '',
      },
    },
    node.description,
  );
  assert.ok(issues.parameters.name.length > 0);
  assert.ok(issues.parameters.parentId.length > 0);
});

test('DingTalk validates business fields and its errors are preserved without local restrictions', async () => {
  const input = {
    name: '研发,测试',
    code: 'a'.repeat(31),
    language: 'custom-language',
    order: 1.5,
    parent_id: 0,
    hide_dept: 'false',
    new_api_field: true,
    force_update_fields: 'name',
  };
  const { context, calls } = createContext({ deptId: 42, sendBody: 'json', jsonBody: input }, [
    { errcode: 40035, errmsg: '钉钉返回：参数非法' },
  ]);
  await assert.rejects(
    operations.get('department.update').run.call(context, 0),
    /钉钉返回：参数非法/,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].options.body, { ...input, dept_id: 42 });
});

test('JSON updates omit unset fields while retaining false, zero, and API extension fields', async () => {
  const { context, calls } = createContext({
    deptId: 42,
    sendBody: 'json',
    jsonBody: {
      dept_id: 99,
      name: '',
      source_identifier: '  ',
      parent_id: null,
      code: undefined,
      dept_manager_userid_list: [],
      hide_dept: false,
      order: 0,
      new_api_field: 'value',
    },
  });
  await operations.get('department.update').run.call(context, 0);
  assert.deepEqual(calls[0].options.body, {
    dept_id: 42,
    hide_dept: false,
    order: 0,
    new_api_field: 'value',
  });
});

test('node execution resolves department updates independently for each input item', async () => {
  const { context, calls } = createContext([
    { operation: 'department.update', deptId: '42', additionalFields: { name: '研发部' } },
    {
      operation: 'department.update',
      deptId: '43',
      additionalFields: { hideDept: false, order: 0 },
    },
  ]);
  const [results] = await new DingtalkNode().execute.call(context);
  assert.deepEqual(
    calls.map((call) => call.options.body),
    [
      { dept_id: 42, name: '研发部' },
      { dept_id: 43, hide_dept: false, order: 0 },
    ],
  );
  assert.deepEqual(
    results.map((item) => item.pairedItem),
    [{ item: 0 }, { item: 1 }],
  );
});

test('permission failures remain errors without retrying department writes', async () => {
  const { context, calls } = createContext({ deptId: 42, additionalFields: { name: '研发二部' } }, [
    { errcode: 43007, errmsg: '权限不足' },
  ]);
  await assert.rejects(operations.get('department.update').run.call(context, 0), /权限不足/);
  assert.equal(calls.length, 1);
});
