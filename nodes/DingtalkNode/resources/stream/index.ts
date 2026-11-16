import { makeResourceBundle } from '../../../shared/resource';
import respond from './respond';

export default makeResourceBundle({
  value: 'stream',
  name: '事件订阅',
  operations: [respond],
});
