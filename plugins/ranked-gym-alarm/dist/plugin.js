var capacitorAlarm = (function (exports, core) {
    'use strict';

    /**
     * @since 0.1.0
     */
    exports.ErrorCode = void 0;
    (function (ErrorCode) {
        /**
         * No app that can handle alarms was found on the device.
         *
         * @since 0.1.0
         */
        ErrorCode["NoClockApp"] = "NO_CLOCK_APP";
        /**
         * The permission to schedule alarms was denied.
         *
         * @since 0.1.0
         */
        ErrorCode["PermissionDenied"] = "PERMISSION_DENIED";
    })(exports.ErrorCode || (exports.ErrorCode = {}));
    /**
     * The days of the week.
     *
     * @since 0.1.0
     */
    exports.Weekday = void 0;
    (function (Weekday) {
        /**
         * @since 0.1.0
         */
        Weekday["Friday"] = "FRIDAY";
        /**
         * @since 0.1.0
         */
        Weekday["Monday"] = "MONDAY";
        /**
         * @since 0.1.0
         */
        Weekday["Saturday"] = "SATURDAY";
        /**
         * @since 0.1.0
         */
        Weekday["Sunday"] = "SUNDAY";
        /**
         * @since 0.1.0
         */
        Weekday["Thursday"] = "THURSDAY";
        /**
         * @since 0.1.0
         */
        Weekday["Tuesday"] = "TUESDAY";
        /**
         * @since 0.1.0
         */
        Weekday["Wednesday"] = "WEDNESDAY";
    })(exports.Weekday || (exports.Weekday = {}));

    const Alarm = core.registerPlugin('Alarm', {
        web: () => Promise.resolve().then(function () { return web; }).then(m => new m.AlarmWeb()),
    });

    class AlarmWeb extends core.WebPlugin {
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

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        AlarmWeb: AlarmWeb
    });

    exports.Alarm = Alarm;

    return exports;

})({}, capacitorExports);
//# sourceMappingURL=plugin.js.map
