import { makeResourceBundle } from '../../../shared/resource';
import tokenGet from './tokenGet';

export default makeResourceBundle({
  value: 'auth',
  name: '应用授权',
  operations: [tokenGet],
});
