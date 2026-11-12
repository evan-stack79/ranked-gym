import { WebPlugin } from '@capacitor/core';
import type { AlarmPlugin, CancelAlarmOptions, CreateAlarmOptions, CreateAlarmResult, CreateTimerOptions, GetAlarmsResult, IsAvailableResult, PermissionStatus } from './definitions';
export declare class AlarmWeb extends WebPlugin implements AlarmPlugin {
    cancelAlarm(_options: CancelAlarmOptions): Promise<void>;
    checkPermissions(): Promise<PermissionStatus>;
    createAlarm(_options: CreateAlarmOptions): Promise<CreateAlarmResult>;
    createTimer(_options: CreateTimerOptions): Promise<void>;
    getAlarms(): Promise<GetAlarmsResult>;
    isAvailable(): Promise<IsAvailableResult>;
    openAlarms(): Promise<void>;
    requestPermissions(): Promise<PermissionStatus>;
}
