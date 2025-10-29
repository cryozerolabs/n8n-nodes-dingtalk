import { makeResourceBundle } from '../../../shared/resource';
import processesInstancesComments from './processesInstancesComments';
import processesInstances from './processesInstances';
import processesInstancesDownload from './processesInstancesDownload';
import processesInstancesIds from './processesInstancesIds';
import processesInstancesSpacesInfos from './processesInstancesSpacesInfos';
import processesTemplatesUserVisibilities from './processesTemplatesUserVisibilities';
import processesInstancesUpdate from './processesInstancesUpdate';
import methods from './methods';

export default makeResourceBundle({
  value: 'workflow',
  name: 'OA审批',
  operations: [
    processesInstancesComments,
    processesInstancesDownload,
    processesInstances,
    processesInstancesIds,
    processesInstancesSpacesInfos,
    processesInstancesUpdate,
    processesTemplatesUserVisibilities,
  ],
  methods,
});
