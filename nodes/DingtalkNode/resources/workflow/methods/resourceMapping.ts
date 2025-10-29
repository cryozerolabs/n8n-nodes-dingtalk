import type {
  IExecuteFunctions,
  IDataObject,
  ILoadOptionsFunctions,
  ResourceMapperField,
  ResourceMapperFields,
} from 'n8n-workflow';
import { request } from '../../../../shared/request';

type RequestCtx = IExecuteFunctions | ILoadOptionsFunctions;

interface WorkflowControl {
  id: string;
  label: string;
  bizAlias?: string;
  required: boolean;
}

interface ControlWithPath {
  control: WorkflowControl;
  path: string[];
}

const toText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const collectControls = (
  items: IDataObject[] | undefined,
  ancestors: string[] = [],
): ControlWithPath[] => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const results: ControlWithPath[] = [];

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;

    const node = raw as IDataObject;
    const props = node.props as IDataObject | undefined;
    const componentName = toText(node.componentName) ?? 'Unknown';
    const label = toText(props?.label);
    const bizAlias = toText(props?.bizAlias);
    const id = toText(props?.id);
    const required = props?.required === true;

    const groupName = label ?? bizAlias ?? componentName;
    const nextAncestors = groupName ? [...ancestors, groupName] : ancestors;

    if (id && label) {
      const breadcrumbs = ancestors.length > 0 ? [...ancestors, label] : [label];
      results.push({
        control: { id, label, bizAlias, required },
        path: breadcrumbs,
      });
    }

    const children = node.children as IDataObject[] | undefined;
    if (Array.isArray(children) && children.length > 0) {
      results.push(...collectControls(children, nextAncestors));
    }
  }

  return results;
};

async function fetchWorkflowControls(
  ctx: RequestCtx,
  processCode: string,
): Promise<ControlWithPath[]> {
  if (!processCode) return [];

  const resp = (await request.call(ctx, {
    method: 'GET',
    url: '/workflow/forms/schemas/processCodes',
    qs: { processCode },
  })) as IDataObject;

  const schemaContent = (resp.result as IDataObject)?.schemaContent as IDataObject | undefined;
  const items = schemaContent?.items as IDataObject[] | undefined;

  const controlsWithPath = collectControls(items);

  const unique = new Map<string, ControlWithPath>();
  for (const entry of controlsWithPath) {
    if (!unique.has(entry.control.id)) {
      unique.set(entry.control.id, entry);
    }
  }

  return Array.from(unique.values());
}

export async function getWorkflowFormControls(
  ctx: RequestCtx,
  processCode: string,
): Promise<WorkflowControl[]> {
  const controls = await fetchWorkflowControls(ctx, processCode);
  return controls.map((entry) => entry.control);
}

export async function workflowGetProcessVariables(
  this: ILoadOptionsFunctions,
): Promise<ResourceMapperFields> {
  const processCode = this.getNodeParameter('processCode', undefined, {
    extractValue: true,
  }) as string;

  if (!processCode) {
    return {
      fields: [],
      emptyFieldsNotice: '请先填写审批流的唯一码（processCode），然后再尝试加载表单控件。',
    };
  }

  const controls = await fetchWorkflowControls(this, processCode);

  const fields: ResourceMapperField[] = controls.map(({ control, path }) => {
    const pathLabel = path.join(' / ');
    const displayName = control.bizAlias
      ? `${pathLabel} (${control.bizAlias})`
      : pathLabel || control.label;

    return {
      id: control.id,
      displayName,
      required: control.required,
      defaultMatch: false,
      canBeUsedToMatch: true,
      display: true,
      readOnly: false,
      type: 'string',
    };
  });

  return { fields };
}
