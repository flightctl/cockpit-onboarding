declare module 'service.js' {
    import cockpit from 'cockpit';

    interface ServiceEvents extends cockpit.EventMap {
        changed: () => void;
    }

    interface ServiceProxy extends cockpit.EventSource<ServiceEvents> {
        exists: boolean | null;
        state: string | null;
        enabled: boolean | null;
        unit?: cockpit.DBusProxy;
        details?: cockpit.DBusProxy;
        service?: cockpit.DBusProxy;

        wait(callback: () => void): void;
        start(): Promise<void>;
        stop(): Promise<void>;
        restart(): Promise<void>;
        tryRestart(): Promise<void>;
        enable(): Promise<void>;
        disable(): Promise<void>;
        getRunJournal(options?: string[]): Promise<string> | cockpit.Spawn<string>;
    }

    export function proxy(name: string, kind?: string): ServiceProxy;
}