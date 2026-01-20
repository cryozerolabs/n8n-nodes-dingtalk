import { makeResourceBundle } from '../../../shared/resource';
import columnsDelete from './columnsDelete';
import columnsInsertBefore from './columnsInsertBefore';
import columnsVisibility from './columnsVisibility';
import rangesAppend from './rangesAppend';
import rangesClear from './rangesClear';
import rangesClearData from './rangesClearData';
import rangesGet from './rangesGet';
import rangesUpdate from './rangesUpdate';
import rowsDelete from './rowsDelete';
import rowsInsertBefore from './rowsInsertBefore';
import rowsVisibility from './rowsVisibility';
import sheetsCreate from './sheetsCreate';
import sheetsDelete from './sheetsDelete';
import sheetsGet from './sheetsGet';
import sheetsGetAll from './sheetsGetAll';

import methods from './methods/index';

export default makeResourceBundle({
  value: 'workbooks',
  name: '表格',
  operations: [
    columnsDelete,
    columnsInsertBefore,
    columnsVisibility,
    rangesAppend,
    rangesClear,
    rangesClearData,
    rangesGet,
    rangesUpdate,
    rowsDelete,
    rowsInsertBefore,
    rowsVisibility,
    sheetsCreate,
    sheetsDelete,
    sheetsGet,
    sheetsGetAll,
  ],
  methods,
});
