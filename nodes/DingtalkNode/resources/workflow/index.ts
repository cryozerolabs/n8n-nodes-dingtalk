import { makeResourceBundle } from '../../../shared/resource';
import formsScheams from './formsScheams';
import processesInstancesComments from './processesInstancesComments';
import processesInstances from './processesInstances';
import processesInstancesIds from './processesInstancesIds';
import processesTemplatesUserVisibilities from './processesTemplatesUserVisibilities';

export default makeResourceBundle({
  value: 'workflow',
  name: 'OA审批',
  operations: [
    formsScheams,
    processesInstancesComments,
    processesInstances,
    processesInstancesIds,
    processesTemplatesUserVisibilities,
  ],
});
