import { makeResourceBundle } from '../../../shared/resource';
import request from './request';

export default makeResourceBundle({
  value: 'api',
  name: '自定义 API 请求',
  operations: [request],
});
