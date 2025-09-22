import { makeResourceBundle } from '../../../shared/resource';

export default makeResourceBundle({
	value: 'auth',
	name: '应用授权',
	dir: __dirname, // 指向编译后的 dist/.../resources/notable
});
