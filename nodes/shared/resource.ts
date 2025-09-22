/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { INodeProperties } from 'n8n-workflow';
import type { OperationDef } from './operation';

export interface ResourceBundle {
	value: string; // 资源值，如 'notable' / 'user'
	name: string; // 资源显示名
	operations: OperationDef[]; // 本资源下的全部操作
	operationProperty: INodeProperties; // 本资源的 Operation 下拉（带 show.resource）
	properties: INodeProperties[]; // 聚合后的参数（补了 show.resource）
}

/** 给参数补上 displayOptions.show.resource = [resource]，不覆盖原 operation 过滤 */
function attachResourceShow(props: INodeProperties[], resource: string): INodeProperties[] {
	return props.map((p) => {
		const existed = p.displayOptions?.show ?? {};
		const existedRes = (existed as Record<string, unknown>).resource as string[] | undefined;
		const nextRes = Array.isArray(existedRes)
			? Array.from(new Set([...existedRes, resource]))
			: [resource];

		return {
			...p,
			displayOptions: {
				...(p.displayOptions ?? {}),
				show: { ...existed, resource: nextRes },
			},
		};
	});
}

/** 扫描指定目录，加载默认导出的 OperationDef（仅 .js，排除 index.js） */
export function loadOperationsFromDirSync(dir: string): OperationDef[] {
	const ops: OperationDef[] = [];
	if (!fs.existsSync(dir)) return ops;

	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		if (!e.isFile()) continue;
		const file = path.join(dir, e.name);
		if (!file.endsWith('.js')) continue;
		if (path.basename(file).startsWith('index.')) continue;

		const mod = require(file);
		const def: unknown = mod.default ?? mod.op ?? mod.operation;
		if (!def || typeof def !== 'object') continue;

		const od = def as OperationDef;
		if (
			typeof od.value === 'string' &&
			typeof od.name === 'string' &&
			Array.isArray(od.properties) &&
			typeof od.run === 'function'
		) {
			ops.push(od);
		}
	}

	// 单目录内去重 + 排序
	const seen: Record<string, number> = {};
	for (const o of ops) seen[o.value] = (seen[o.value] ?? 0) + 1;
	if (Object.values(seen).some((c) => c > 1)) {
		const dupList = Object.entries(seen)
			.filter(([, c]) => c > 1)
			.map(([v, c]) => `${v} x${c}`)
			.join(', ');
		throw new Error(`Duplicate operations in ${dir}: ${dupList}`);
	}

	ops.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
	return ops;
}

/** 一行生成资源包：传入资源名/值 + 目录(__dirname) */
export function makeResourceBundle(args: {
	value: string;
	name: string;
	dir: string;
}): ResourceBundle {
	const { value, name, dir } = args;
	const operations = loadOperationsFromDirSync(dir);

	const operationProperty: INodeProperties = {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: [value] } },
		options: operations.map((o) => ({
			name: o.name,
			value: o.value,
			action: o.action ?? o.name,
			description: o.description,
		})),
		default: '', // 让用户显式选择
	};

	const properties = attachResourceShow(
		operations.flatMap((o) => o.properties),
		value,
	);

	return { value, name, operations, operationProperty, properties };
}
