import { config as n8nConfig } from '@n8n/node-cli/eslint';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';

const typeScriptResolver = createTypeScriptImportResolver();

export default [
  ...n8nConfig,
  {
    settings: {
      'import-x/resolver-next': [typeScriptResolver],
      'import-x/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
    },
    rules: {
      // 中文语境，描述不会以Whether开头，允许使用没有whether的布尔值描述，
      'n8n-nodes-base/node-param-description-boolean-without-whether': 'off',
      // 允许使用非svg的icon
      'n8n-nodes-base/node-class-description-icon-not-svg': 'off',
      // 允许使用未排序的选项，一般同一组的选项会放在一起，排序后不方便阅读
      'n8n-nodes-base/node-param-options-type-unsorted-items': 'off',
      'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',

      'n8n-nodes-base/node-param-description-wrong-for-dynamic-options': 'off',
      // 中文语境，不会以Name or ID作为描述结尾
      'n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options': 'off',

      'n8n-nodes-base/node-param-description-miscased-id': 'off',
    },
  },
];
