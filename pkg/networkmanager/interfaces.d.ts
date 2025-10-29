/* eslint-disable no-use-before-define */
import cockpit from 'cockpit';

// Type definitions for Cockpit NetworkManager interfaces
// This file provides TypeScript types for interfaces.js (from Cockpit project)
// Created by cockpit-system-onboarding project

export interface NetworkManagerEvents extends cockpit.EventMap {
    changed: () => void;
}

export interface Interface {
    Name: string;
    Device: Device | null;
    Connections: Connection[];
    MainConnection: Connection | null;
}

export interface Device {
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

    activate(connection: Connection, specific_object?: unknown): Promise<ActiveConnection>;
    activate_with_settings(settings: unknown, specific_object?: unknown): Promise<ActiveConnection>;
    disconnect(): Promise<void>;
}

export interface Connection {
    Settings: Record<string, unknown>;
    Unsaved?: boolean;
    Groups: Connection[];
    Members: Connection[];
    Interfaces: Interface[];

    copy_settings(): Record<string, unknown>;
    apply_settings(settings: Record<string, unknown>): Promise<void>;
    activate(dev: Device | null, specific_object?: unknown): Promise<ActiveConnection>;
    delete_(): Promise<void>;
}

export interface ActiveConnection {
    Connection: Connection;
    Ip4Config: Ipv4Config | null;
    Ip6Config: Ipv6Config | null;
    Group?: Device;

    deactivate(): Promise<void>;
}

export interface Ipv4Config {
    Addresses: string[][];
    Nameservers?: string[];
}

export interface Ipv6Config {
    Addresses: string[][];
    Nameservers?: string[];
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
    get_manager(): unknown;
    get_settings(): unknown;
    synchronize(): Promise<void>;
    close(): void;
}

export const NetworkManagerModel: new () => NetworkManagerModel;
export function show_unexpected_error(error: unknown): void;
export function connection_settings(c: unknown): unknown;
export function device_state_text(dev: unknown): string;
export function is_managed(dev: unknown): boolean;
export function render_active_connection(dev: unknown, arg1: boolean, arg2: boolean): unknown;
