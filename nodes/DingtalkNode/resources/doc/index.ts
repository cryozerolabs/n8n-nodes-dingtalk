import { makeResourceBundle } from '../../../shared/resource';
import resourceGetUploadInfo from './resourceGetUploadinfo';
import uploadAttachment from './uploadAttachment';

export default makeResourceBundle({
  value: 'doc',
  name: '文档',
  operations: [resourceGetUploadInfo, uploadAttachment],
});
