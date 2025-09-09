import cockpit from 'cockpit';

// Augment the NetworkManagerModel function to return an EventSource
declare global {
    namespace JSX {
        // This ensures the file is treated as a module
    }
}

// Module declarations for imports that need event source typing
declare module './interfaces.js' {
    interface NetworkManagerEvents extends cockpit.EventMap {
        changed: () => void;
    }

    interface Interface {
        Name: string;
        Device: Device | null;
        Connections: Connection[];
        MainConnection: Connection | null;
    }

    interface Device {
        DeviceType: string;
        Interface: string;
        StateText: string;
        State: number;
        HwAddress: string;
        AvailableConnections: Connection[];
        ActiveConnection: ActiveConnection | null;
        Ip4Config: Ipv4Config | null;
        Ip6Config: Ipv6Config | null;
        Udi: string;
        IdVendor: string;
        IdModel: string;
        Driver: string;
        Carrier: boolean;
        Speed?: number;
        Managed: boolean;
        Members: Device[];

        activate(connection: Connection, specific_object?: any): Promise<ActiveConnection>;
        activate_with_settings(settings: any, specific_object?: any): Promise<ActiveConnection>;
        disconnect(): Promise<void>;
    }

    interface Connection {
        Settings: any;
        Unsaved?: boolean;
        Groups: Connection[];
        Members: Connection[];
        Interfaces: Interface[];

        copy_settings(): any;
        apply_settings(settings: any): Promise<void>;
        activate(dev: Device | null, specific_object?: any): Promise<ActiveConnection>;
        delete_(): Promise<void>;
    }

    interface ActiveConnection {
        Connection: Connection;
        Ip4Config: Ipv4Config | null;
        Ip6Config: Ipv6Config | null;
        Group?: Device;

        deactivate(): Promise<void>;
    }

    interface Ipv4Config {
        Addresses: string[][];
    }

    interface Ipv6Config {
        Addresses: string[][];
    }

    export interface NetworkManagerModel extends cockpit.EventSource<NetworkManagerEvents> {
        client: cockpit.DBusClient;
        preinit: Promise<void>;
        curtain?: string;
        operationInProgress?: boolean;
        ready?: boolean;
        
        set_curtain(state: string): void;
        set_operation_in_progress(value: boolean): void;
        list_interfaces(): Interface[];
        find_interface(name: string): Interface | null;
        get_manager(): any;
        get_settings(): any;
        synchronize(): Promise<void>;
        close(): void;
    }

    export function NetworkManagerModel(): NetworkManagerModel;
    export function show_unexpected_error(error: any): void;
    export function connection_settings(c: any): any;
    export function device_state_text(dev: any): string;
    export function is_managed(dev: any): boolean;
    export function render_active_connection(dev: any, arg1: boolean, arg2: boolean): any;
}