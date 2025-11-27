import { makeResourceBundle } from '../../../shared/resource';
import resourceGetUploadInfo from './resourceGetUploadinfo';
import uploadAttachment from './uploadAttachment';
import workbooksColumnsDelete from './workbooksColumnsDelete';
import workbooksColumnsInsertBefore from './workbooksColumnsInsertBefore';
import workbooksColumnsVisibility from './workbooksColumnsVisibility';
import workbooksRangesClear from './workbooksRangesClear';
import workbooksRangesClearData from './workbooksRangesClearData';
import workbooksRangesGet from './workbooksRangesGet';
import workbooksRowsDelete from './workbooksRowsDelete';
import workbooksRowsInsertBefore from './workbooksRowsInsertBefore';
import workbooksRowsVisibility from './workbooksRowsVisibility';
import workbooksSheetCreate from './workbooksSheetCreate';
import workbooksSheetDelete from './workbooksSheetDelete';
import workbooksSheetGet from './workbooksSheetGet';
import workbooksSheets from './workbooksSheets';

import methods from './methods/index';

export default makeResourceBundle({
  value: 'doc',
  name: '文档',
  operations: [
    resourceGetUploadInfo,
    uploadAttachment,
    workbooksColumnsDelete,
    workbooksColumnsInsertBefore,
    workbooksColumnsVisibility,
    workbooksRangesClear,
    workbooksRangesClearData,
    workbooksRangesGet,
    workbooksRowsDelete,
    workbooksRowsInsertBefore,
    workbooksRowsVisibility,
    workbooksSheetCreate,
    workbooksSheetDelete,
    workbooksSheetGet,
    workbooksSheets,
  ],
  methods,
});
