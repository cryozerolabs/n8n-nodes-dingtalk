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
 * 资源定位器 - baseId
 */
export function baseProps(displayOptions: IDisplayOptions): INodeProperties[] {
  return [
    {
      displayName: 'AI表格',
      name: 'baseId',
      type: 'resourceLocator',
      default: { mode: 'id', value: '' },
      required: true,
      modes: [
        {
          displayName: 'By ID',
          name: 'id',
          type: 'string',
          placeholder: 'baseId,可通过[解析URL]获取',
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
      displayOptions,
    },
  ];
}
export function getBase(ctx: IExecuteFunctions, itemIndex: number): string {
  return ctx.getNodeParameter('baseId', itemIndex, undefined, {
    extractValue: true,
  }) as string;
}

/**
 * 资源定位器 - sheetIdOrName
 */
export function sheetProps(displayOptions: IDisplayOptions): INodeProperties[] {
  return [
    {
      displayName: '数据表',
      name: 'sheetIdOrName',
      type: 'resourceLocator',
      default: { mode: 'id', value: '' },
      required: true,
      typeOptions: {
        loadOptionsDependsOn: ['baseId.value'], // methods/listSeach
      },
      modes: [
        {
          displayName: 'From List',
          name: 'list',
          type: 'list',
          typeOptions: {
            searchListMethod: 'sheetSearch',
            searchable: true,
          },
        },
        {
          displayName: 'By ID',
          name: 'id',
          type: 'string',
          placeholder: 'sheetId,可通过[解析URL]获取',
        },
        {
          displayName: 'From URL',
          name: 'url',
          type: 'string',
          placeholder: 'https://alidocs.dingtalk.com/i/nodes/...?',
          validation: [validation.alidocs],
          extractValue: {
            type: 'regex',
            // 匹配 iframeQuery 内 URL 编码的 sheetId
            regex: 'iframeQuery=[^#]*?sheetId%3D([A-Za-z0-9_-]+)',
          },
        },
      ],
      displayOptions,
    },
  ];
}
export function getSheet(ctx: IExecuteFunctions, itemIndex: number): string {
  return ctx.getNodeParameter('sheetIdOrName', itemIndex, '', {
    extractValue: true,
  }) as string;
}
