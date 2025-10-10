import type { ILoadOptionsFunctions, INodePropertyOptions, IDataObject } from 'n8n-workflow';
import { request } from '../../../../shared/request';
import { getOperatorIdForLoadOptions } from '../../../../shared/properties/operator';

/**
 * 获取字段列表
 */
export async function notableGeFields(
  this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
  const baseId = this.getNodeParameter('baseId', undefined, { extractValue: true }) as string;
  const sheet = this.getNodeParameter('sheetIdOrName', undefined, { extractValue: true }) as string;
  const operatorId = await getOperatorIdForLoadOptions(this);

  if (!baseId || !sheet || !operatorId) {
    return [];
  }

  const resp = await request.call(this, {
    method: 'GET',
    url: `/notable/bases/${baseId}/sheets/${sheet}/fields`,
    qs: { operatorId },
  });

  const fields = (resp as IDataObject).value as IDataObject[];
  return (fields || []).map((f) => ({
    name: String(f.name),
    value: String(f.name), // 使用 name 而不是 id，更友好
    description: `类型: ${String(f.type || '未知')}`,
  }));
}

/**
 * 获取字段列表并添加到选项中
 * @param this
 * @returns
 */
export async function notableGetFieldsAndAddOptions(
  this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
  // 首先尝试从API获取字段列表
  const apiFields = await notableGeFields.call(this);
  if (apiFields && apiFields.length > 0) {
    return apiFields;
  }

  // 如果API获取失败或为空，从用户已设置的筛选条件中提取字段
  const userFields = new Set<string>();

  // 获取当前节点的所有筛选条件中的字段
  try {
    const filter = this.getNodeParameter('filter', undefined) as IDataObject;
    if (filter && filter.conditions && Array.isArray(filter.conditions)) {
      (filter.conditions as IDataObject[]).forEach((condition: IDataObject) => {
        if (condition.field && typeof condition.field === 'string') {
          userFields.add(condition.field);
        }
      });
    }
  } catch {
    // 忽略参数获取错误
  }

  // 转换为选项格式
  const options = Array.from(userFields).map((field) => ({
    name: field,
    value: field,
  }));

  return options;
}
