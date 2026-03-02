import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { systemConfigurationService } from './system-config.js';
import { Interface } from '../pkg/networkmanager/interfaces.js';
import {
    HostnameState,
    NetworkInterfaceState,
    NetworkAddressState,
    NetworkServicesState,
    EnrollmentState,
} from './types';

// NetworkAddressConfig - internal type for compatibility with existing code
// Uses string instead of string | null for backward compatibility
interface NetworkAddressConfig {
  ipv4: {
    method: 'dhcp' | 'static' | 'auto' | 'disabled';
    address: string;
    subnetMask: string;
    gateway: string;
    autoDns: boolean;
    primaryDns: string;
    secondaryDns: string;
  };
  ipv6: {
    method: 'dhcp' | 'static' | 'auto' | 'disabled';
    address: string;
    gateway: string;
    autoDns: boolean;
    primaryDns: string;
    secondaryDns: string;
  };
}

export interface Model {
  hostname: HostnameState;
  networkInterface: NetworkInterfaceState;
  networkAddress: NetworkAddressState;
  // Store original interface configurations for quick switching (internal format)
  originalNetworkConfigs: { [interfaceName: string]: NetworkAddressConfig };
  // Store user-modified configurations per interface (internal format)
  userNetworkConfigs: { [interfaceName: string]: NetworkAddressConfig };
  networkServices: NetworkServicesState;
  enrollment: EnrollmentState;
  enrollmentProgress: {
    currentStep: number; // 0-3
    stepStates: ('pending' | 'running' | 'success' | 'error')[];
    logs: string[]; // execution logs
    executionState: 'idle' | 'running' | 'success' | 'failed'; // overall execution state
    canCancel: boolean; // whether cancellation is possible
    overallProgress: number; // 0-100 percentage
  };
  wizardStep: number;
}

// Default network address configuration (internal format)
const defaultNetworkConfig: NetworkAddressConfig = {
    ipv4: {
        method: 'auto',
        address: '',
        subnetMask: '',
        gateway: '',
        autoDns: true,
        primaryDns: '',
        secondaryDns: '',
    },
    ipv6: {
        method: 'auto',
        address: '',
        gateway: '',
        autoDns: true,
        primaryDns: '',
        secondaryDns: '',
    },
};

// Initial state
const initialModel: Model = {
    hostname: {
        value: '',
        dhcpHostname: '',
    },
    networkInterface: {
        selectedInterface: null,
        interfaceType: null,
        wifiSsid: null,
        wifiPassword: null,
        wifiSecurity: null,
        vlanId: null,
    },
    networkAddress: {
        ipv4: {
            method: 'auto',
            address: null,
            subnetMask: null,
            gateway: null,
            autoDns: true,
            primaryDns: null,
            secondaryDns: null,
        },
        ipv6: {
            method: 'auto',
            address: null,
            gateway: null,
            autoDns: true,
            primaryDns: null,
            secondaryDns: null,
        },
    },
    originalNetworkConfigs: {},
    userNetworkConfigs: {},
    networkServices: {
        ntp: {
            autoConfig: true,
            servers: [],
        },
        proxy: {
            enabled: false,
            hostname: null,
            port: null,
            username: null,
            password: null,
        },
    },
    enrollment: {
        selectedServices: [],
        credentials: {},
        endpoints: {},
    },
    enrollmentProgress: {
        currentStep: 0,
        stepStates: ['pending', 'pending', 'pending', 'pending'],
        logs: [],
        executionState: 'idle',
        canCancel: false,
        overallProgress: 0,
    },
    wizardStep: 1,
};

// Context type combining existing NetworkManager model and application model
interface ModelContextType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  networkManager?: any; // Keep existing NetworkManager model
  model: Model;
  isInitialized: boolean;
  updateModel: (section: keyof Model, updates: Partial<Model[keyof Model]>) => void;
  updateNestedModel: <T extends keyof Model, K extends keyof Model[T]>(
    section: T,
    subsection: K,
    updates: Partial<Model[T][K]>
  ) => void;
  switchToInterfaceConfig: (interfaceName: string) => void;
  saveCurrentNetworkConfig: () => void;
  parseIpv6Address: (addressWithPrefix: string) => { address: string; prefix: number };
  formatIpv6Address: (address: string, prefix: number) => string;
  cancelEnrollmentRef: React.MutableRefObject<(() => void) | null>;
}

// Create context
export const ModelContext = createContext<ModelContextType | undefined>(undefined);

// Helper to convert NetworkAddressState to NetworkAddressConfig (for internal use)
const stateToConfig = (state: NetworkAddressState): NetworkAddressConfig => {
    return {
        ipv4: {
            method: state.ipv4.method,
            address: state.ipv4.address ?? '',
            subnetMask: state.ipv4.subnetMask ?? '',
            gateway: state.ipv4.gateway ?? '',
            autoDns: state.ipv4.autoDns,
            primaryDns: state.ipv4.primaryDns ?? '',
            secondaryDns: state.ipv4.secondaryDns ?? '',
        },
        ipv6: {
            method: state.ipv6.method,
            address: state.ipv6.address ?? '',
            gateway: state.ipv6.gateway ?? '',
            autoDns: state.ipv6.autoDns,
            primaryDns: state.ipv6.primaryDns ?? '',
            secondaryDns: state.ipv6.secondaryDns ?? '',
        },
    };
};

// Helper to convert NetworkAddressConfig to NetworkAddressState
const configToState = (config: NetworkAddressConfig): NetworkAddressState => {
    // Map 'dhcp' to 'auto' for type compatibility with NetworkAddressState
    const mapMethod = (method: 'dhcp' | 'static' | 'auto' | 'disabled'): 'auto' | 'static' | 'disabled' => {
        return method === 'dhcp' ? 'auto' : method;
    };

    return {
        ipv4: {
            method: mapMethod(config.ipv4.method),
            address: config.ipv4.address || null,
            subnetMask: config.ipv4.subnetMask || null,
            gateway: config.ipv4.gateway || null,
            autoDns: config.ipv4.autoDns,
            primaryDns: config.ipv4.primaryDns || null,
            secondaryDns: config.ipv4.secondaryDns || null,
        },
        ipv6: {
            method: mapMethod(config.ipv6.method),
            address: config.ipv6.address || null,
            gateway: config.ipv6.gateway || null,
            autoDns: config.ipv6.autoDns,
            primaryDns: config.ipv6.primaryDns || null,
            secondaryDns: config.ipv6.secondaryDns || null,
        },
    };
};

// Helper function to convert prefix length to subnet mask
const prefixToSubnetMask = (prefix: number): string => {
    if (prefix < 0 || prefix > 32) {
        return '';
    }

    const mask = (-1 << (32 - prefix)) >>> 0;
    return [
        (mask >>> 24) & 255,
        (mask >>> 16) & 255,
        (mask >>> 8) & 255,
        mask & 255
    ].join('.');
};

// Helper function to parse IPv6 address with prefix
export const parseIpv6Address = (addressWithPrefix: string): { address: string; prefix: number } => {
    if (!addressWithPrefix) {
        return { address: '', prefix: 64 };
    }

    const parts = addressWithPrefix.split('/');
    const address = parts[0] || '';
    const prefix = parts[1] ? parseInt(parts[1], 10) : 64;

    return { address, prefix };
};

// Helper function to format IPv6 address with prefix
export const formatIpv6Address = (address: string, prefix: number): string => {
    if (!address) {
        return '';
    }
    return `${address}/${prefix}`;
};

// Helper function to extract network configuration from an interface
const extractNetworkConfig = (iface: Interface): NetworkAddressConfig => {
    const config: NetworkAddressConfig = { ...defaultNetworkConfig };

    if (!iface.Device || !iface.Device.ActiveConnection) {
        return config;
    }

    const activeConnection = iface.Device.ActiveConnection;

    // IPv4 configuration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ipv4Method = (iface.MainConnection?.Settings as any)?.ipv4?.method || 'dhcp';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ipv4ConnectionDns = (iface.MainConnection?.Settings as any)?.ipv4?.dns || [];

    if (activeConnection.Ip4Config && activeConnection.Ip4Config.Addresses && activeConnection.Ip4Config.Addresses.length > 0) {
        const address = activeConnection.Ip4Config.Addresses[0];
        // Get DNS servers from active config (includes DHCP-provided DNS) and connection settings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activeDns = (activeConnection.Ip4Config as any).Nameservers || [];
        const hasStaticDns = ipv4ConnectionDns.length > 0;
        const dnsServers = hasStaticDns ? ipv4ConnectionDns : activeDns;

        config.ipv4 = {
            ...config.ipv4,
            method: ipv4Method === 'manual' ? 'static' : 'dhcp',
            address: address[0] || '',
            subnetMask: address[1] ? prefixToSubnetMask(Number(address[1])) : '',
            gateway: address[2] || '',
            autoDns: !hasStaticDns,
            primaryDns: dnsServers[0] || '',
            secondaryDns: dnsServers[1] || ''
        };
    } else if (ipv4ConnectionDns.length > 0) {
        // Handle case where there are DNS settings but no active addresses
        config.ipv4 = {
            ...config.ipv4,
            method: ipv4Method === 'manual' ? 'static' : 'dhcp',
            autoDns: false,
            primaryDns: ipv4ConnectionDns[0] || '',
            secondaryDns: ipv4ConnectionDns[1] || ''
        };
    }

    // IPv6 configuration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ipv6Method = (iface.MainConnection?.Settings as any)?.ipv6?.method || 'dhcp';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ipv6ConnectionDns = (iface.MainConnection?.Settings as any)?.ipv6?.dns || [];

    if (activeConnection.Ip6Config && activeConnection.Ip6Config.Addresses && activeConnection.Ip6Config.Addresses.length > 0) {
        const address = activeConnection.Ip6Config.Addresses[0];
        // Get DNS servers from active config (includes DHCP-provided DNS) and connection settings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const activeDns = (activeConnection.Ip6Config as any).Nameservers || [];
        const hasStaticDns = ipv6ConnectionDns.length > 0;
        const dnsServers = hasStaticDns ? ipv6ConnectionDns : activeDns;

        config.ipv6 = {
            ...config.ipv6,
            method: ipv6Method === 'manual' ? 'static' : ipv6Method === 'ignore' ? 'disabled' : 'dhcp',
            address: address[0] && address[1] ? `${address[0]}/${address[1]}` : address[0] || '',
            gateway: address[2] || '',
            autoDns: !hasStaticDns,
            primaryDns: dnsServers[0] || '',
            secondaryDns: dnsServers[1] || ''
        };
    } else if (ipv6ConnectionDns.length > 0) {
        // Handle case where there are DNS settings but no active addresses
        config.ipv6 = {
            ...config.ipv6,
            method: ipv6Method === 'manual' ? 'static' : ipv6Method === 'ignore' ? 'disabled' : 'dhcp',
            autoDns: false,
            primaryDns: ipv6ConnectionDns[0] || '',
            secondaryDns: ipv6ConnectionDns[1] || ''
        };
    }

    return config;
};

// Provider component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ModelProvider: React.FunctionComponent<{ children: ReactNode; networkManager?: any }> = ({ children, networkManager }) => {
    const [model, setModel] = useState<Model>(initialModel);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const cancelEnrollmentRef = useRef<(() => void) | null>(null);

    const updateModel = (section: keyof Model, updates: Partial<Model[keyof Model]>) => {
        setModel(prev => ({
            ...prev,
            [section]: {
                ...(prev[section] as object),
                ...(updates as object),
            },
        }));
    };

    const updateNestedModel = <T extends keyof Model, K extends keyof Model[T]>(
        section: T,
        subsection: K,
        updates: Partial<Model[T][K]>
    ) => {
        setModel(prev => {
            const prevSection = prev[section];
            const prevSubsection = prevSection[subsection];

            const newModel = {
                ...prev,
                [section]: {
                    ...(prevSection as object),
                    [subsection]: {
                        ...(prevSubsection as object),
                        ...updates,
                    },
                },
            };

            // Auto-save user network config when networkAddress is updated
            if (section === 'networkAddress' && prev.networkInterface.selectedInterface) {
                newModel.userNetworkConfigs = {
                    ...prev.userNetworkConfigs,
                    [prev.networkInterface.selectedInterface]: stateToConfig(newModel.networkAddress)
                };
            }

            return newModel;
        });
    };

    const switchToInterfaceConfig = (interfaceName: string) => {
        // Save current changes to the previously selected interface
        const currentSelectedInterface = model.networkInterface.selectedInterface;
        if (currentSelectedInterface && currentSelectedInterface !== interfaceName) {
            setModel(prev => ({
                ...prev,
                userNetworkConfigs: {
                    ...prev.userNetworkConfigs,
                    [currentSelectedInterface]: stateToConfig(prev.networkAddress)
                }
            }));
        }

        // Load configuration for the new interface (user config takes priority over original)
        const userConfig = model.userNetworkConfigs[interfaceName];
        const originalConfig = model.originalNetworkConfigs[interfaceName];
        const configToUse = userConfig || originalConfig || defaultNetworkConfig;

        setModel(prev => ({
            ...prev,
            networkAddress: configToState(configToUse)
        }));
    };

    const saveCurrentNetworkConfig = () => {
        const currentSelectedInterface = model.networkInterface.selectedInterface;
        if (currentSelectedInterface) {
            setModel(prev => ({
                ...prev,
                userNetworkConfigs: {
                    ...prev.userNetworkConfigs,
                    [currentSelectedInterface]: stateToConfig(prev.networkAddress)
                }
            }));
        }
    };

    const initializeFromSystem = async () => {
        if (!networkManager) {
            console.warn('Cannot initialize: networkManager is not available');
            setIsInitialized(true);
            return;
        }

        if (!networkManager.ready) {
            console.warn('Cannot initialize: networkManager is not ready');
            setIsInitialized(true);
            return;
        }

        try {
            const interfaces: Interface[] = networkManager.list_interfaces();
            const systemInfo = await systemConfigurationService.getSystemInfo(interfaces);

            // Extract network configurations for all interfaces
            const originalConfigs: { [interfaceName: string]: NetworkAddressConfig } = {};
            interfaces.forEach(iface => {
                originalConfigs[iface.Name] = extractNetworkConfig(iface);
            });

            // Get default interface configuration
            const defaultConfig = systemInfo.defaultInterface && originalConfigs[systemInfo.defaultInterface]
                ? originalConfigs[systemInfo.defaultInterface]
                : defaultNetworkConfig;

            // Determine the best default hostname
            // Use DHCP hostname if static hostname is not set or is localhost
            let defaultHostname = systemInfo.hostname;
            if (!defaultHostname || defaultHostname === 'localhost' || defaultHostname === 'localhost.localdomain') {
                defaultHostname = systemInfo.dhcpHostname || defaultHostname;
            }

            // Determine the interface type for the default interface
            const defaultInterface = interfaces.find(iface => iface.Name === systemInfo.defaultInterface);
            const defaultInterfaceType = defaultInterface?.Device?.DeviceType === '802-11-wireless' ? 'wifi' : 'ethernet';

            // Update model with system information
            setModel(prev => ({
                ...prev,
                hostname: {
                    value: defaultHostname,
                    dhcpHostname: systemInfo.dhcpHostname
                },
                networkInterface: {
                    ...prev.networkInterface,
                    selectedInterface: systemInfo.defaultInterface,
                    interfaceType: systemInfo.defaultInterface ? defaultInterfaceType : null
                },
                networkAddress: configToState(defaultConfig),
                originalNetworkConfigs: originalConfigs,
                userNetworkConfigs: {},
                networkServices: {
                    ntp: {
                        ...prev.networkServices.ntp,
                        servers: systemInfo.ntpServers,
                        autoConfig: systemInfo.ntpServers.length === 0
                    },
                    proxy: {
                        ...prev.networkServices.proxy
                    }
                }
            }));

            setIsInitialized(true);
        } catch (error) {
            console.error('Failed to initialize model from system:', error);
            setIsInitialized(true); // Still mark as initialized even if some parts failed
        }
    };

    useEffect(() => {
        if (networkManager && !isInitialized) {
            // If networkManager exists, attempt initialization regardless of ready state
            // This handles cases where ready might be false or undefined
            if (networkManager.ready) {
                initializeFromSystem();
            } else {
                // If not ready, still mark as initialized to prevent infinite loading
                // The wizard will work with default/empty values
                setIsInitialized(true);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [networkManager, networkManager?.ready, isInitialized]);

    useEffect(() => {
    // Cleanup system info service on unmount
        return () => {
            systemConfigurationService.close();
        };
    }, []);

    return (
        <ModelContext.Provider value={{
            networkManager,
            model,
            isInitialized,
            updateModel,
            updateNestedModel,
            switchToInterfaceConfig,
            saveCurrentNetworkConfig,
            parseIpv6Address,
            formatIpv6Address,
            cancelEnrollmentRef
        }}
        >
            {children}
        </ModelContext.Provider>
    );
};

// Hook to use model context
export const useModelContext = () => {
    const context = useContext(ModelContext);
    if (context === undefined) {
        throw new Error('useModelContext must be used within a ModelProvider');
    }
    return context;
};
