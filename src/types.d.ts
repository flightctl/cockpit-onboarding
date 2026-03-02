/**
 * TypeScript type definitions for Cockpit System Onboarding Plugin
 * Derived from data-model.md
 */

/* eslint-disable no-use-before-define, @typescript-eslint/no-explicit-any */

// ========== Configuration Types (SystemOnboardingConfig) ==========

export interface SystemOnboardingConfig {
    version: string;
    runOnce?: boolean;
    keepCockpit?: boolean;
    hideModules?: boolean;
    autoReboot?: boolean;
    network?: NetworkConfig;
    enrollmentServices?: EnrollmentService[];
    led?: LedConfig;
}

export interface NetworkConfig {
    wifiAp?: WifiApConfig;
    ethernet?: EthernetConfig;
}

export interface WifiApConfig {
    enabled?: boolean;
    ssidPrefix?: string;
    interface?: string;
    password?: string;
}

export interface EthernetConfig {
    enabled?: boolean;
    interface?: string;
    staticIp?: string;
}

export interface EnrollmentService {
    id: string;
    name: string;
    description?: string;
    endpoint: EndpointConfig;
    credentialsSchema: any; // JSON Schema Draft 7
    scriptPath: string;
}

export interface EndpointConfig {
    url: string;
    allowUserOverride?: boolean;
}

export interface LedConfig {
    enabled?: boolean;
    tool?: string;
    states?: Record<LedState, string>;
}

export type LedState = 'ready' | 'in-progress' | 'applying' | 'success' | 'error' | 'off';

// ========== Runtime State Types (OnboardingSession) ==========

export interface OnboardingSession {
    hostname: HostnameState;
    networkInterface: NetworkInterfaceState;
    networkAddress: NetworkAddressState;
    networkServices: NetworkServicesState;
    enrollment: EnrollmentState;
    wizardStep: number;
}

export interface HostnameState {
    value: string;
    dhcpHostname?: string;
}

export interface NetworkInterfaceState {
    selectedInterface: string | null;
    interfaceType: 'ethernet' | 'wifi' | null;
    wifiSsid: string | null;
    wifiPassword: string | null;
    wifiSecurity: 'none' | 'wep' | 'wpa' | null;
    vlanId: number | null;
}

export interface NetworkAddressState {
    ipv4: IPv4Config;
    ipv6: IPv6Config;
}

export interface IPv4Config {
    method: 'auto' | 'static' | 'disabled';
    address: string | null;
    subnetMask: string | null;
    gateway: string | null;
    autoDns: boolean;
    primaryDns: string | null;
    secondaryDns: string | null;
}

export interface IPv6Config {
    method: 'auto' | 'static' | 'disabled';
    address: string | null; // with /prefix
    gateway: string | null;
    autoDns: boolean;
    primaryDns: string | null;
    secondaryDns: string | null;
}

export interface NetworkServicesState {
    ntp: NtpConfig;
    proxy: ProxyConfig;
}

export interface NtpConfig {
    autoConfig: boolean;
    servers: string[];
}

export interface ProxyConfig {
    enabled: boolean;
    hostname: string | null;
    port: number | null;
    username: string | null;
    password: string | null;
}

export interface EnrollmentState {
    selectedServices: string[];
    credentials: Record<string, any>;
    endpoints: Record<string, string>;
}

// ========== System Integration Types ==========

export interface NetworkInterface {
    name: string;
    type: 'ethernet' | 'wifi' | 'other';
    macAddress: string;
    state: number;
    ipv4Address: string | null;
    ipv6Address: string | null;
    connection: any | null;
}

export interface WifiNetwork {
    ssid: string;
    strength: number;
    security: 'none' | 'wep' | 'wpa';
    frequency: number;
}

export interface ApplyResult {
    success: boolean;
    results: string[];
    errors?: Error[];
}

// ========== Enrollment Script Result ==========

export interface EnrollmentResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    deviceUrl?: string; // Parsed from stdout "DEVICE_URL: ..."
}
