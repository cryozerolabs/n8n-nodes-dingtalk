import { makeResourceBundle } from '../../../shared/resource';
import batchSend from './batchSend';
import dingRecall from './dingRecall';
import dingSend from './dingSend';
import send from './send';

export default makeResourceBundle({
  value: 'robot',
  name: '机器人',
  operations: [batchSend, dingRecall, dingSend, send],
});
