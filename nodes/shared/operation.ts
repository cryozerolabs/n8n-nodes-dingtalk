import type { INodeExecutionData, INodeProperties, IExecuteFunctions } from 'n8n-workflow';

export interface OperationDef {
	/** 唯一操作值，如 'user.get'、'notable.recordAdd' */
	value: string;
	/** UI 显示名 */
	name: string;
	action?: string;
	description?: string;
	/** 参数（用 displayOptions.show.operation = [value] 控制显隐） */
	properties: INodeProperties[];
	/** 纯程序式执行（推荐） */
	run: (this: IExecuteFunctions, itemIndex: number) => Promise<INodeExecutionData>;
}
