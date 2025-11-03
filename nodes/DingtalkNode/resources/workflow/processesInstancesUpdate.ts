import type {
  INodeExecutionData,
  INodeProperties,
  IDataObject,
  IExecuteFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';
import { bodyProps, getBodyData } from '../../../shared/properties/body';
import { getWorkflowFormControls } from './methods/resourceMapping';

function toStringValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const OP = 'workflow.processes.instancesUpdate';
const showOnly = { show: { operation: [OP] } };

const formProperties: INodeProperties[] = [
  {
    displayName: '操作人userId',
    name: 'opUserId',
    type: 'string',
    default: '',
    required: true,
    description: '必须为管理员身份',
    displayOptions: showOnly,
  },
  {
    displayName: '审批流的唯一码',
    name: 'processCode',
    type: 'string',
    default: '',
    description: 'ProcessCode可以在审批表单编辑页-基础设置-页面底部查看获取',
    displayOptions: showOnly,
  },
  {
    displayName: '流程实例ID',
    name: 'processInstanceId',
    type: 'string',
    default: '',
    required: true,
    displayOptions: showOnly,
  },
  {
    displayName: '表单变量',
    name: 'variables',
    type: 'resourceMapper',
    default: {
      mappingMode: 'defineBelow',
      value: null,
    },
    required: true,
    noDataExpression: true,
    displayOptions: showOnly,
    description:
      '映射审批表单控件的值。若需要同时设置扩展值，可输入 {"value": "...", "extValue": "..."}。',
    typeOptions: {
      loadOptionsDependsOn: ['processCode'],
      resourceMapper: {
        resourceMapperMethod: 'workflowGetProcessVariables',
        mode: 'add',
        fieldWords: {
          singular: '控件',
          plural: '控件',
        },
        addAllFields: false,
        multiKeyMatch: true,
      },
    },
  },
  {
    displayName: '备注内容',
    name: 'remark',
    type: 'string',
    default: '',
    displayOptions: showOnly,
  },
];

const properties: INodeProperties[] = [
  ...bodyProps(showOnly, {
    defaultJsonBody: JSON.stringify(
      {
        opUserId: 'manager432',
        processCode: 'PROC-EF6YJL35P2-SCKICSB7P750S0YISYKV3-xxxx-1',
        variables: [
          {
            id: 'PhoneField_IZI2LP8QF6O0',
            bizAlias: 'Phone',
            value: '123xxxxxxxx',
            extValue: '总个数:1',
          },
        ],
        processInstanceId: 'processInstanceId-1',
        remark: 'remark',
      },
      null,
      2,
    ),
    formProperties,
  }),
];

const op: OperationDef = {
  value: OP,
  name: '💎更新流程表单审批实例',
  description: '[钉钉专业版]用于更新流程表单审批实例，支持对流程中和已完成的实例数据进行更新',
  properties,

  async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
    const sendBodyMode = this.getNodeParameter('sendBody', itemIndex, 'form') as string;
    const processCode = this.getNodeParameter('processCode', itemIndex, '') as string;

    let controlMap = new Map<string, { bizAlias?: string }>();
    if (sendBodyMode !== 'json' && processCode) {
      const controls = await getWorkflowFormControls(this, processCode);
      controlMap = new Map(controls.map((control) => [control.id, { bizAlias: control.bizAlias }]));
    }

    const body = getBodyData(this, itemIndex, {
      formBuilder: (ctx: IExecuteFunctions, idx: number) => {
        const opUserId = ctx.getNodeParameter('opUserId', idx) as string;
        const processInstanceId = ctx.getNodeParameter('processInstanceId', idx) as string;
        const currentProcessCode = ctx.getNodeParameter('processCode', idx, '') as string;
        const remark = ctx.getNodeParameter('remark', idx, '') as string;

        const dataMode = ctx.getNodeParameter('variables.mappingMode', idx) as string;
        const variables: IDataObject[] = [];

        const pushVariable = (fieldId: string, rawValue: unknown) => {
          if (rawValue === undefined) return;

          let mainValue: unknown = rawValue;
          let extValue: unknown;
          if (typeof rawValue === 'object' && rawValue !== null && !Array.isArray(rawValue)) {
            const rawObj = rawValue as IDataObject;
            if ('value' in rawObj || 'extValue' in rawObj) {
              mainValue = rawObj.value;
              extValue = rawObj.extValue;
            }
          }

          if (mainValue === undefined && extValue === undefined) return;

          const variable: IDataObject = {
            id: fieldId,
            value: toStringValue(mainValue),
          };

          const meta = controlMap.get(fieldId);
          if (meta?.bizAlias) {
            variable.bizAlias = meta.bizAlias;
          }

          if (extValue !== undefined) {
            variable.extValue = toStringValue(extValue);
          }

          variables.push(variable);
        };

        if (dataMode === 'defineBelow') {
          const mapped = ctx.getNodeParameter('variables.value', idx, {}) as IDataObject;
          for (const [fieldId, rawValue] of Object.entries(mapped)) {
            pushVariable(fieldId, rawValue);
          }
        } else if (dataMode === 'autoMapInputData') {
          const matchingColumns = ctx.getNodeParameter(
            'variables.matchingColumns',
            idx,
            [],
          ) as string[];
          if (matchingColumns.length > 0) {
            const input = ctx.getInputData()[idx];
            const inputJson = (input?.json ?? {}) as IDataObject;
            for (const fieldId of matchingColumns) {
              if (Object.prototype.hasOwnProperty.call(inputJson, fieldId)) {
                pushVariable(fieldId, inputJson[fieldId]);
              }
            }
          }
        }

        if (variables.length === 0) {
          throw new NodeOperationError(ctx.getNode(), '请至少映射一个表单控件的值', {
            itemIndex: idx,
          });
        }

        if (variables.length > 150) {
          throw new NodeOperationError(ctx.getNode(), '变量数量不能超过 150 个', {
            itemIndex: idx,
          });
        }

        const result: IDataObject = {
          opUserId,
          processInstanceId,
          variables,
        };

        if (currentProcessCode) {
          result.processCode = currentProcessCode;
        }

        if (remark) {
          result.remark = remark;
        }

        return result;
      },
    });

    const resp = await request.call(this, {
      method: 'PUT',
      url: '/workflow/premium/processInstances',
      body,
    });

    const out: IDataObject = resp as IDataObject;
    return {
      json: out,
      pairedItem: { item: itemIndex },
    };
  },
};

export default op;
