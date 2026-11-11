import { WebPlugin } from '@capacitor/core';
export class AlarmWeb extends WebPlugin {
    async cancelAlarm(_options) {
        throw this.unimplemented('Not implemented on web.');
    }
    async checkPermissions() {
        throw this.unimplemented('Not implemented on web.');
    }
    async createAlarm(_options) {
        throw this.unimplemented('Not implemented on web.');
    }
    async createTimer(_options) {
        throw this.unimplemented('Not implemented on web.');
    }
    async getAlarms() {
        throw this.unimplemented('Not implemented on web.');
    }
    async isAvailable() {
        throw this.unimplemented('Not implemented on web.');
    }
    async openAlarms() {
        throw this.unimplemented('Not implemented on web.');
    }
    async requestPermissions() {
        throw this.unimplemented('Not implemented on web.');
    }
}
//# sourceMappingURL=web.js.map