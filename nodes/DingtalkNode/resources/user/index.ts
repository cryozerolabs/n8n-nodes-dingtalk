import { makeResourceBundle } from '../../../shared/resource';
import get from './get';
import getByMobile from './getByMobile';
import listDepartmentUserIds from './listDepartmentUserIds';
import listDepartmentUsers from './listDepartmentUsers';
import listLeaveRecords from './listLeaveRecords';
import listParentDepartmentIds from './listParentDepartmentIds';
import search from './search';

export default makeResourceBundle({
  value: 'user',
  name: '用户管理',
  operations: [
    get,
    getByMobile,
    listDepartmentUserIds,
    listDepartmentUsers,
    listLeaveRecords,
    listParentDepartmentIds,
    search,
  ],
});
