import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

export interface TodoTaskBodyInput {
  sourceId?: unknown;
  subject?: unknown;
  creatorId?: unknown;
  description?: unknown;
  dueTime?: unknown;
  executorIds?: unknown;
  participantIds?: unknown;
  detailUrl?: unknown;
  pcDetailUrl?: unknown;
  isOnlyShowExecutor?: unknown;
  priority?: unknown;
  dingNotify?: unknown;
  done?: unknown;
}

export const unionIdProperty = (displayOptions: INodeProperties['displayOptions']) => ({
  displayName: '用户 Union ID',
  name: 'unionId',
  type: 'string' as const,
  default: '',
  required: true,
  description: '待办路径中的用户 unionId。可通过「用户管理 / 查询用户详情」获取。',
  displayOptions,
});

export const taskIdProperty = (displayOptions: INodeProperties['displayOptions']) => ({
  displayName: '待办任务 ID',
  name: 'taskId',
  type: 'string' as const,
  default: '',
  required: true,
  displayOptions,
});

export function getUnionId(ctx: IExecuteFunctions, itemIndex: number): string {
  return ctx.getNodeParameter('unionId', itemIndex) as string;
}

export function getTaskId(ctx: IExecuteFunctions, itemIndex: number): string {
  return ctx.getNodeParameter('taskId', itemIndex) as string;
}

export function encodePath(value: string): string {
  return encodeURIComponent(value);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function splitCommaSeparatedValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter((item) => item.length > 0);
  }
  if (typeof value !== 'string') return [];

  return value
    .trim()
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function normalizeOptionalTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  const raw = optionalString(value);
  if (!raw) return undefined;

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    throw new Error('截止时间必须是毫秒时间戳或合法的 ISO-8601 时间字符串');
  }

  return timestamp;
}

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  const raw = optionalString(value);
  if (!raw) return undefined;

  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function addOptionalString(body: IDataObject, key: string, value: unknown) {
  const text = optionalString(value);
  if (text) body[key] = text;
}

function buildDetailUrl(input: TodoTaskBodyInput): IDataObject | undefined {
  const appUrl = optionalString(input.detailUrl);
  const pcUrl = optionalString(input.pcDetailUrl) ?? appUrl;
  if (!appUrl && !pcUrl) return undefined;

  return {
    appUrl: appUrl ?? pcUrl,
    pcUrl: pcUrl ?? appUrl,
  };
}

function addOptionalMutableTaskFields(body: IDataObject, input: TodoTaskBodyInput) {
  addOptionalString(body, 'subject', input.subject);
  addOptionalString(body, 'description', input.description);

  const dueTime = normalizeOptionalTimestamp(input.dueTime);
  if (dueTime !== undefined) body.dueTime = dueTime;

  const executorIds = splitCommaSeparatedValues(input.executorIds);
  if (executorIds.length > 0) body.executorIds = executorIds;

  const participantIds = splitCommaSeparatedValues(input.participantIds);
  if (participantIds.length > 0) body.participantIds = participantIds;
}

function addOptionalCreateTaskFields(body: IDataObject, input: TodoTaskBodyInput) {
  const detailUrl = buildDetailUrl(input);
  if (detailUrl) body.detailUrl = detailUrl;

  const priority = normalizeOptionalNumber(input.priority);
  if (priority !== undefined) body.priority = priority;
}

export function buildCreateTaskBody(input: TodoTaskBodyInput): IDataObject {
  const body: IDataObject = {};

  addOptionalString(body, 'sourceId', input.sourceId);
  addOptionalString(body, 'creatorId', input.creatorId);
  addOptionalMutableTaskFields(body, input);
  addOptionalCreateTaskFields(body, input);

  if (typeof input.isOnlyShowExecutor === 'boolean') {
    body.isOnlyShowExecutor = input.isOnlyShowExecutor;
  }

  if (input.dingNotify === true) {
    body.notifyConfigs = {
      dingNotify: '1',
    };
  }

  return body;
}

export function buildUpdateTaskBody(input: TodoTaskBodyInput): IDataObject {
  const body: IDataObject = {};
  addOptionalMutableTaskFields(body, input);

  if (typeof input.done === 'boolean') {
    body.done = input.done;
  }

  return body;
}

export function buildListTasksBody(input: { nextToken?: unknown; isDone?: unknown }): IDataObject {
  const body: IDataObject = {};

  addOptionalString(body, 'nextToken', input.nextToken);
  if (typeof input.isDone === 'boolean') {
    body.isDone = input.isDone;
  }

  return body;
}

export function buildExecutorStatusBody(executorIds: unknown, isDone: boolean): IDataObject {
  return {
    executorStatusList: splitCommaSeparatedValues(executorIds).map((id) => ({
      id,
      isDone,
    })),
  };
}
