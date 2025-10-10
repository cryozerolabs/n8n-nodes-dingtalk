import { makeResourceBundle } from '../../../shared/resource';
import resourceGetUploadInfo from './resourceGetUploadinfo';

export default makeResourceBundle({
  value: 'doc',
  name: '文档',
  operations: [resourceGetUploadInfo],
});
