import { makeResourceBundle } from '../../../shared/resource';
import resourceGetUploadInfo from './resourceGetUploadinfo';
import resourceUploadAttachment from './resourceUploadAttachment';

export default makeResourceBundle({
  value: 'doc',
  name: '文档',
  operations: [resourceGetUploadInfo, resourceUploadAttachment],
});
