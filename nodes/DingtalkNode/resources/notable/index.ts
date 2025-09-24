import { makeResourceBundle } from '../../../shared/resource';
import fieldCreate from './fieldCreate';
import fieldDelete from './fieldDelete';
import fieldGetAll from './fieldGetAll';
import fieldUpdate from './fieldUpdate';
import parseUrl from './parseUrl';
import recordDelete from './recordDelete';
import recordGet from './recordGet';
import recordInsert from './recordInsert';
import recordList from './recordList';
import recordUpdate from './recordUpdate';
import sheetCreate from './sheetCreate';
import sheetDelete from './sheetDelete';
import sheetGet from './sheetGet';
import sheetGetAll from './sheetGetAll';
import sheetUpdate from './sheetUpdate';

export default makeResourceBundle({
  value: 'notable',
  name: 'AI表格',
  operations: [
    fieldCreate,
    fieldDelete,
    fieldGetAll,
    fieldUpdate,
    parseUrl,
    recordDelete,
    recordGet,
    recordInsert,
    recordList,
    recordUpdate,
    sheetCreate,
    sheetDelete,
    sheetGet,
    sheetGetAll,
    sheetUpdate,
  ],
});
