import { makeResourceBundle } from '../../../shared/resource';
import create from './create';
import deleteDepartment from './delete';
import get from './get';
import list from './list';
import listParentIds from './listParentIds';
import listSubIds from './listSubIds';
import search from './search';
import update from './update';

export default makeResourceBundle({
  value: 'department',
  name: '部门管理',
  operations: [create, deleteDepartment, get, list, listParentIds, listSubIds, search, update],
});
