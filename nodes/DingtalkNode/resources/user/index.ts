import { makeResourceBundle } from '../../../shared/resource';
import get from './get';
import getByMobile from './getByMobile';
import search from './search';

export default makeResourceBundle({
  value: 'user',
  name: '用户管理',
  operations: [get, getByMobile, search],
});
