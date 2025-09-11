import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { systemInfoService } from './system-info';
import { Interface } from './interfaces.js';
import { ip4_prefix_from_text } from './utils.js';

interface NetworkAddressConfig {
  ipv4: {
    method: 'dhcp' | 'static';
    address: string;
    subnetMask: string;
    gateway: string;
    autoDns: boolean;
    primaryDns: string;
    secondaryDns: string;
  };
  ipv6: {
    method: 'dhcp' | 'static' | 'disabled';
    address: string;
    gateway: string;
    autoDns: boolean;
    primaryDns: string;
    secondaryDns: string;
  };
}

export interface Model {
  hostname: {
    value: string;
  };
  networkInterface: {
    selectedInterface: string | null;
    useVlan: boolean;
    vlanId: number | null;
  };
  networkAddress: NetworkAddressConfig;
  // Store original interface configurations for quick switching
  originalNetworkConfigs: { [interfaceName: string]: NetworkAddressConfig };
  // Store user-modified configurations per interface
  userNetworkConfigs: { [interfaceName: string]: NetworkAddressConfig };
  networkServices: {
    ntp: {
      autoConfig: boolean;
      servers: string[];
    };
  };
  enrollment: {
    url: string;
    skipTlsVerification: boolean;
    authMethod: 'username-password' | 'token';
    username: string;
    password: string;
    token: string;
  };
}

// Default network address configuration
const defaultNetworkConfig: NetworkAddressConfig = {
    ipv4: {
        method: 'dhcp',
        address: '',
        subnetMask: '',
        gateway: '',
        autoDns: true,
        primaryDns: '',
        secondaryDns: '',
    },
    ipv6: {
        method: 'disabled',
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
    },
    networkInterface: {
        selectedInterface: null,
        vlanId: 1,
        useVlan: false,
    },
    networkAddress: { ...defaultNetworkConfig },
    originalNetworkConfigs: {},
    userNetworkConfigs: {},
    networkServices: {
        ntp: {
            autoConfig: true,
            servers: [],
        },
    },
    enrollment: {
        url: '',
        skipTlsVerification: false,
        authMethod: 'username-password',
        username: '',
        password: '',
        token: '',
    },
};

// Context type combining existing NetworkManager model and application model
interface ModelContextType {
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
}

// Create context
export const ModelContext = createContext<ModelContextType | undefined>(undefined);

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
    const ipv4Method = iface.MainConnection?.Settings?.ipv4?.method || 'dhcp';
    const ipv4ConnectionDns = iface.MainConnection?.Settings?.ipv4?.dns || [];
    
    if (activeConnection.Ip4Config && activeConnection.Ip4Config.Addresses.length > 0) {
        const address = activeConnection.Ip4Config.Addresses[0];
        // Get DNS servers from active config (includes DHCP-provided DNS) and connection settings
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
    const ipv6Method = iface.MainConnection?.Settings?.ipv6?.method || 'dhcp';
    const ipv6ConnectionDns = iface.MainConnection?.Settings?.ipv6?.dns || [];
    
    if (activeConnection.Ip6Config && activeConnection.Ip6Config.Addresses.length > 0) {
        const address = activeConnection.Ip6Config.Addresses[0];
        // Get DNS servers from active config (includes DHCP-provided DNS) and connection settings
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
export const ModelProvider: React.FunctionComponent<{ children: ReactNode; networkManager?: any }> = ({ children, networkManager }) => {
    const [model, setModel] = useState<Model>(initialModel);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);

    const updateModel = (section: keyof Model, updates: Partial<Model[keyof Model]>) => {
        setModel(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                ...updates,
            },
        }));
    };

    const updateNestedModel = <T extends keyof Model, K extends keyof Model[T]>(
        section: T,
        subsection: K,
        updates: Partial<Model[T][K]>
    ) => {
        setModel(prev => {
            const newModel = {
                ...prev,
                [section]: {
                    ...prev[section],
                    [subsection]: {
                        ...prev[section][subsection],
                        ...updates,
                    },
                },
            };

            // Auto-save user network config when networkAddress is updated
            if (section === 'networkAddress' && prev.networkInterface.selectedInterface) {
                newModel.userNetworkConfigs = {
                    ...prev.userNetworkConfigs,
                    [prev.networkInterface.selectedInterface]: { ...newModel.networkAddress }
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
                    [currentSelectedInterface]: { ...prev.networkAddress }
                }
            }));
        }

        // Load configuration for the new interface (user config takes priority over original)
        const userConfig = model.userNetworkConfigs[interfaceName];
        const originalConfig = model.originalNetworkConfigs[interfaceName];
        const configToUse = userConfig || originalConfig || defaultNetworkConfig;

        setModel(prev => ({
            ...prev,
            networkAddress: { ...configToUse }
        }));
    };

    const saveCurrentNetworkConfig = () => {
        const currentSelectedInterface = model.networkInterface.selectedInterface;
        if (currentSelectedInterface) {
            setModel(prev => ({
                ...prev,
                userNetworkConfigs: {
                    ...prev.userNetworkConfigs,
                    [currentSelectedInterface]: { ...prev.networkAddress }
                }
            }));
        }
    };

    const initializeFromSystem = async () => {
        if (!networkManager || !networkManager.ready) {
            return;
        }

        try {
            const interfaces: Interface[] = networkManager.list_interfaces();
            const systemInfo = await systemInfoService.getSystemInfo(interfaces);

            // Extract network configurations for all interfaces
            const originalConfigs: { [interfaceName: string]: NetworkAddressConfig } = {};
            interfaces.forEach(iface => {
                originalConfigs[iface.Name] = extractNetworkConfig(iface);
            });

            // Get default interface configuration
            const defaultConfig = systemInfo.defaultInterface && originalConfigs[systemInfo.defaultInterface]
                ? originalConfigs[systemInfo.defaultInterface]
                : defaultNetworkConfig;

            // Update model with system information
            setModel(prev => ({
                ...prev,
                hostname: {
                    value: systemInfo.hostname
                },
                networkInterface: {
                    ...prev.networkInterface,
                    selectedInterface: systemInfo.defaultInterface
                },
                networkAddress: { ...defaultConfig },
                originalNetworkConfigs: originalConfigs,
                userNetworkConfigs: {},
                networkServices: {
                    ntp: {
                        ...prev.networkServices.ntp,
                        servers: systemInfo.ntpServers,
                        autoConfig: systemInfo.ntpServers.length === 0
                    }
                }
            }));

            setIsInitialized(true);
        } catch (error) {
            console.warn('Failed to initialize model from system:', error);
            setIsInitialized(true); // Still mark as initialized even if some parts failed
        }
    };

    useEffect(() => {
        if (networkManager && networkManager.ready && !isInitialized) {
            initializeFromSystem();
        }
    }, [networkManager, networkManager?.ready, isInitialized, initializeFromSystem]);

    useEffect(() => {
    // Cleanup system info service on unmount
        return () => {
            systemInfoService.close();
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
            formatIpv6Address
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
