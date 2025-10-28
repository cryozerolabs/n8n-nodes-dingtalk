import { makeResourceBundle } from '../../../shared/resource';
import dingRecall from './dingRecall';
import dingSend from './dingSend';
import send from './send';

export default makeResourceBundle({
  value: 'robot',
  name: '机器人',
  operations: [dingRecall, dingSend, send],
});
