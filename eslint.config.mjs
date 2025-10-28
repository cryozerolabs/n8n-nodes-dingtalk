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
  },
];
