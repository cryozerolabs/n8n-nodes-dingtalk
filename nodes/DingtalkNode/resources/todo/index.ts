import { makeResourceBundle } from '../../../shared/resource';
import create from './create';
import deleteTask from './delete';
import get from './get';
import getBySourceId from './getBySourceId';
import list from './list';
import update from './update';
import updateExecutorStatus from './updateExecutorStatus';

export default makeResourceBundle({
  value: 'todo',
  name: '待办任务',
  operations: [create, deleteTask, get, getBySourceId, list, update, updateExecutorStatus],
});
