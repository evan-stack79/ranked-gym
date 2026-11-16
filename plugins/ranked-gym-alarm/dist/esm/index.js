import { registerPlugin } from '@capacitor/core';
const Alarm = registerPlugin('Alarm', {
    web: () => import('./web').then(m => new m.AlarmWeb()),
});
export * from './definitions';
export { Alarm };
//# sourceMappingURL=index.js.map