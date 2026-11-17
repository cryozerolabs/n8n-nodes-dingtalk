import { makeResourceBundle } from '../../../shared/resource';
import getFailedEvents from './getFailedEvents';
import respond from './respond';

export default makeResourceBundle({
  value: 'stream',
  name: '事件订阅',
  operations: [getFailedEvents, respond],
});
