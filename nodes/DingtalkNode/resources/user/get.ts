import type {
	INodeExecutionData,
	INodeProperties,
	IDataObject,
	IExecuteFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import type { OperationDef } from '../../../shared/operation';
import { request } from '../../../shared/request';

const OP = 'user.get';
const showOnly = { show: { operation: [OP] } };

const properties: INodeProperties[] = [
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showOnly,
	},
];

interface UserGetResp {
	errcode?: number;
	errmsg?: string;
	result?: { unionid?: string; userid?: string; [k: string]: unknown };
	[k: string]: unknown;
}

const op: OperationDef = {
	value: OP,
	name: '用户管理 查询用户详情',
	description: '调用本接口获取指定用户的详细信息。',
	properties,

	// ★ 关键：显式标注 this 和返回类型
	async run(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData> {
		const userid = this.getNodeParameter('userId', itemIndex) as string;

		// ★ 关键：带 this 绑定的函数用 .call(this, ...)；泛型用 as 断言收回类型
		const resp = (await request.call(this, {
			method: 'POST',
			url: 'https://oapi.dingtalk.com/topapi/v2/user/get',
			headers: { 'Content-Type': 'application/json' },
			body: { userid },
			json: true,
		})) as UserGetResp;

		if (typeof resp.errcode === 'number' && resp.errcode !== 0) {
			throw new NodeOperationError(
				this.getNode(),
				`TopAPI error ${resp.errcode}: ${resp.errmsg ?? ''}`,
				{ itemIndex },
			);
		}

		// ★ 关键：收敛为 IDataObject
		const payload: IDataObject = (resp.result ?? resp) as unknown as IDataObject;

		return {
			json: payload,
			pairedItem: { item: itemIndex },
		};
	},
};

export default op;
