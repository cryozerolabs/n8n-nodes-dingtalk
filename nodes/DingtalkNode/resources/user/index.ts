import { makeResourceBundle } from '../../../shared/resource';
import get from './get';

export default makeResourceBundle({
  value: 'user',
  name: '用户管理',
  operations: [get],
});
