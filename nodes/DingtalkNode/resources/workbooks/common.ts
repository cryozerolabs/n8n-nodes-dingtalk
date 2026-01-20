import { IDisplayOptions, INodeProperties, IExecuteFunctions } from 'n8n-workflow';
/**
 * 校验规则
 */
const validation = {
  alidocs: {
    type: 'regex',
    properties: {
      regex: '^https://[^/]*alidocs\\.dingtalk\\.com/.+',
      errorMessage: '请输入合法的AI表格URL',
    },
  },
};

/**
 * 资源定位器 - workbookId
 */
export function workbookProps(displayOptions: IDisplayOptions): INodeProperties[] {
  return [
    {
      displayName: '表格文件',
      name: 'workbookId',
      type: 'resourceLocator',
      default: { mode: 'id', value: '' },
      required: true,
      modes: [
        {
          displayName: 'By ID',
          name: 'id',
          type: 'string',
          hint:
            '可通过<a href=" https://img.alicdn.com/imgextra/i4/O1CN01tVLwQt1eYShxfyw7S_!!6000000003883-2-tps-1714-604.png" target="_blank">如图所示步骤</a>获取。',
        },
        {
          displayName: 'From URL',
          name: 'url',
          type: 'string',
          placeholder: 'https://alidocs.dingtalk.com/i/nodes/...?',
          // 基本校验
          validation: [validation.alidocs],
          // 解析URL
          extractValue: {
            type: 'regex',
            regex: '/i/nodes/([^/?#]+)',
          },
        },
      ],
      description:
        '表格文件 ID ，知识库 API 返回的nodeId(dentryUuid)即是表格workbookId，可通过调用[获取节点]和[创建知识库文档]获取。',
      displayOptions,
    },
  ];
}
export function getWorkbook(ctx: IExecuteFunctions, itemIndex: number): string {
  return ctx.getNodeParameter('workbookId', itemIndex, undefined, {
    extractValue: true,
  }) as string;
}

/**
 * 资源定位器 - sheetId
 */
export function sheetProps(displayOptions: IDisplayOptions): INodeProperties[] {
  return [
    {
      displayName: '工作表',
      name: 'sheetId',
      type: 'resourceLocator',
      default: { mode: 'id', value: '' },
      required: true,
      typeOptions: {
        loadOptionsDependsOn: ['workbookId.value'], // methods/listSeach
      },
      modes: [
        {
          displayName: 'From List',
          name: 'list',
          type: 'list',
          typeOptions: {
            searchListMethod: 'workbookSheetsSearch',
            searchable: true,
          },
        },
        {
          displayName: 'By ID',
          name: 'id',
          type: 'string',
        },
      ],
      description: '工作表ID或名称，可调用[获取所有工作表]获取id或name参数值。',
      displayOptions,
    },
  ];
}
export function getSheet(ctx: IExecuteFunctions, itemIndex: number): string {
  return ctx.getNodeParameter('sheetId', itemIndex, '', {
    extractValue: true,
  }) as string;
}
