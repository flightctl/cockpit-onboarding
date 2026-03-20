import React from 'react';
import cockpit from 'cockpit';
const _ = cockpit.gettext;

import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { NumberInput } from "@patternfly/react-core/dist/esm/components/NumberInput/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner/index.js";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { WifiIcon } from '@patternfly/react-icons';
import { useModelContext } from '../model-context';
import { systemConfigurationService } from '../system-config.js';

import {
    device_state_text,
    is_managed,
} from '../../pkg/networkmanager/interfaces.js';

interface NetworkInterfacePageProps {
    interfaces: import('../../pkg/networkmanager/interfaces.js').Interface[];
}

export const NetworkInterfacePage: React.FunctionComponent<NetworkInterfacePageProps> = ({ interfaces }) => {
    const { model } = useModelContext();

    function hasGroup(iface: import('../../pkg/networkmanager/interfaces.js').Interface) {
        return ((iface.Device &&
                 iface.Device.ActiveConnection &&
                 iface.Device.ActiveConnection.Group &&
                 iface.Device.ActiveConnection.Group.Members.length > 0) ||
                (iface.MainConnection &&
                 iface.MainConnection.Groups.length > 0));
    }

    const filteredInterfaces = interfaces.filter(iface => {
        // Skip loopback
        if (iface.Name === "lo" || (iface.Device && iface.Device.DeviceType === 'loopback'))
            return false;

        // Skip members
        if (hasGroup(iface))
            return false;

        return true;
    });

    // Find selected interface to check if it's WiFi
    const selectedIface = filteredInterfaces.find(iface =>
        iface.Name === model.networkInterface.selectedInterface
    );
    const isWifiSelected = selectedIface?.Device?.DeviceType === '802-11-wireless';

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Choose a network interface to use for onboarding:</p>
                <NetworkInterfaceSelector interfaces={filteredInterfaces} />
            </StackItem>
            {isWifiSelected && selectedIface && (
                <StackItem>
                    <NetworkWifiSelector
                        interfaceName={selectedIface.Name}
                    />
                </StackItem>
            )}
            <StackItem>
                <p>Optionally, specify the VLAN ID to use on this interface:</p>
                <NetworkVlanSelector />
            </StackItem>
        </Stack>
    );
};

interface NetworkInterfaceSelectorProps {
  interfaces: import('../../pkg/networkmanager/interfaces.js').Interface[];
}

export const NetworkInterfaceSelector: React.FunctionComponent<NetworkInterfaceSelectorProps> = ({ interfaces }) => {
  const { model, updateModel, switchToInterfaceConfig } = useModelContext();

  const columnNames = {
    name: 'Name',
    type: 'Type',
    mac: 'MAC address',
    model: 'Vendor and model',
    speed: 'Speed',
    state: 'State'
  };

  const isIfaceSelectable = (iface: import('../../pkg/networkmanager/interfaces.js').Interface) => {
    if (!iface.Device) return false;
    // Allow selecting WiFi interfaces even if unmanaged (e.g. used as AP during onboarding)
    if (iface.Device.DeviceType === '802-11-wireless') return true;
    return is_managed(iface.Device);
  };

  // Initialize selection if not set
  React.useEffect(() => {
    if (!model.networkInterface.selectedInterface) {
      const defaultSelectedInterface = interfaces.find(iface =>
        iface.Device && iface.Device.State === 100 && isIfaceSelectable(iface)
      );
      if (defaultSelectedInterface) {
        const isWifi = defaultSelectedInterface.Device?.DeviceType === '802-11-wireless';
        updateModel('networkInterface', {
          selectedInterface: defaultSelectedInterface.Name,
          interfaceType: isWifi ? 'wifi' : 'ethernet'
        });
        // Load the network configuration for the default interface
        switchToInterfaceConfig(defaultSelectedInterface.Name);
      }
    }
  }, [interfaces, model.networkInterface.selectedInterface, updateModel, switchToInterfaceConfig]);

  const setSelectedIfaceName = (name: string) => {
    // Determine if the selected interface is WiFi
    const selectedIface = interfaces.find(iface => iface.Name === name);
    const isWifi = selectedIface?.Device?.DeviceType === '802-11-wireless';

    updateModel('networkInterface', {
      selectedInterface: name,
      interfaceType: isWifi ? 'wifi' : 'ethernet',
      // Clear WiFi-specific fields when switching to non-WiFi interface
      wifiSsid: isWifi ? model.networkInterface.wifiSsid : null,
      wifiPassword: isWifi ? model.networkInterface.wifiPassword : null,
      wifiSecurity: isWifi ? model.networkInterface.wifiSecurity : null,
    });
    // Switch to the configuration of the newly selected interface
    switchToInterfaceConfig(name);
  };

  return (
      <Table aria-label="Network interface selector" variant="compact">
          <Thead>
              <Tr>
                  <Th screenReaderText="Row select" />
                  <Th>{columnNames.name}</Th>
                  <Th>{columnNames.type}</Th>
                  <Th>{columnNames.mac}</Th>
                  <Th>{columnNames.model}</Th>
                  <Th>{columnNames.speed}</Th>
                  <Th>{columnNames.state}</Th>
              </Tr>
          </Thead>
          <Tbody>
              {interfaces.map((iface, rowIndex) => (
                  <Tr key={iface.Name}>
                      <Td
              select={{
                rowIndex,
                onSelect: () => setSelectedIfaceName(iface.Name),
                isSelected: model.networkInterface.selectedInterface === iface.Name,
                isDisabled: !isIfaceSelectable(iface),
                variant: 'radio',
              }}
                      />
                      <Td dataLabel={columnNames.name}>{iface.Name}</Td>
                      <Td dataLabel={columnNames.type}>{iface.Device?.DeviceType || 'N/A'}</Td>
                      <Td dataLabel={columnNames.mac}>{iface.Device?.HwAddress || 'N/A'}</Td>
                      <Td dataLabel={columnNames.model}>
                          {iface.Device?.IdVendor && iface.Device?.IdModel
                ? `${iface.Device.IdVendor} ${iface.Device.IdModel}`
                : iface.Device?.IdModel || iface.Device?.IdVendor || 'N/A'}
                      </Td>
                      <Td dataLabel={columnNames.speed}>{iface.Device?.Speed ? `${iface.Device.Speed} Mbps` : 'N/A'}</Td>
                      <Td dataLabel={columnNames.state}>{device_state_text(iface.Device)}</Td>
                  </Tr>
        ))}
          </Tbody>
      </Table>
  );
};

interface NetworkWifiSelectorProps {
  interfaceName: string;
}

interface WifiNetwork {
  ssid: string;
  strength: number;
  security: string; // e.g., "None", "WEP", "WPA", "WPA2", "WPA3", "WPA2/WPA3"
  frequency: number;
  channel: number;
  band: '2.4 GHz' | '5 GHz' | 'unknown';
  rate: number;
  bssid: string;
}

export const NetworkWifiSelector: React.FunctionComponent<NetworkWifiSelectorProps> = ({ interfaceName }) => {
  const { model, updateModel } = useModelContext();
  const [isScanning, setIsScanning] = React.useState(false);
  const [networks, setNetworks] = React.useState<WifiNetwork[]>([]);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [selectedBssid, setSelectedBssid] = React.useState<string | null>(null);
  const hasPreSelected = React.useRef(false);
  // Store current connection details in a ref so it can be accessed in handleNetworkSelection
  const currentConnectionRef = React.useRef<{
    ssid: string;
    bssid: string;
    password: string;
    security: 'none' | 'wep' | 'wpa';
  } | null>(null);

  // Get current WiFi connection details and scan networks
  React.useEffect(() => {
    const initializeWifi = async () => {
      // First, get current connection if any
      let current = null;
      try {
        current = await systemConfigurationService.getCurrentWifiConnection(interfaceName);
        currentConnectionRef.current = current;
      } catch (error) {
        console.error('Failed to get current WiFi connection:', error);
      }

      // Then scan for networks
      setIsScanning(true);
      setScanError(null);
      try {
        const scannedNetworks = await systemConfigurationService.scanWifiNetworks(interfaceName);
        setNetworks(scannedNetworks);

        // If we have a current connection and it's in the scanned list, pre-select it
        if (current && !hasPreSelected.current) {
          // Try to find by BSSID first (most specific), then by SSID
          let matchingNetwork = scannedNetworks.find(n =>
            current.bssid && n.bssid === current.bssid
          );

          if (!matchingNetwork) {
            // If no BSSID match, try to find by SSID (might match a different AP of the same network)
            matchingNetwork = scannedNetworks.find(n => n.ssid === current.ssid);
          }

          if (matchingNetwork) {
            // Pre-select the current network
            setSelectedBssid(matchingNetwork.bssid);

            // Map security string to the model's expected type
            let securityType: 'none' | 'wep' | 'wpa' = 'wpa';
            if (matchingNetwork.security === 'None') {
              securityType = 'none';
            } else if (matchingNetwork.security === 'WEP') {
              securityType = 'wep';
            } else {
              securityType = 'wpa';
            }

            // Update model with current network info
            updateModel('networkInterface', {
              wifiSsid: matchingNetwork.ssid,
              wifiSecurity: securityType,
              wifiPassword: current.password, // Pre-fill password
              interfaceType: 'wifi'
            });

            hasPreSelected.current = true;
          }
        }
      } catch (error) {
        console.error('WiFi scan failed:', error);
        setScanError(String(error));
      } finally {
        setIsScanning(false);
      }
    };

    initializeWifi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interfaceName]);

  const handleNetworkSelection = (bssid: string) => {
    setSelectedBssid(bssid);

    // Find the selected network by BSSID
    const selectedNetwork = networks.find(n => n.bssid === bssid);
    if (selectedNetwork) {
      // Map security string to the model's expected type
      // The model expects 'none' | 'wep' | 'wpa', so we simplify complex types
      let securityType: 'none' | 'wep' | 'wpa' = 'wpa';
      if (selectedNetwork.security === 'None') {
        securityType = 'none';
      } else if (selectedNetwork.security === 'WEP') {
        securityType = 'wep';
      } else {
        // WPA, WPA2, WPA3, or any combination -> 'wpa'
        securityType = 'wpa';
      }

      // Check if this is the currently connected network
      const isCurrentNetwork = currentConnectionRef.current &&
        (currentConnectionRef.current.bssid === bssid ||
         currentConnectionRef.current.ssid === selectedNetwork.ssid);

      updateModel('networkInterface', {
        wifiSsid: selectedNetwork.ssid,
        wifiSecurity: securityType,
        // Pre-fill password if this is the currently connected network
        wifiPassword: isCurrentNetwork ? currentConnectionRef.current!.password : null,
        interfaceType: 'wifi'
      });
    }
  };

  const handlePasswordChange = (value: string) => {
    updateModel('networkInterface', { wifiPassword: value });
  };

  const handleRescan = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const scannedNetworks = await systemConfigurationService.scanWifiNetworks(interfaceName);
      setNetworks(scannedNetworks);
    } catch (error) {
      console.error('WiFi scan failed:', error);
      setScanError(String(error));
    } finally {
      setIsScanning(false);
    }
  };

  const getSignalIcon = (strength: number) => {
    if (strength >= 80) return '▂▄▆█';
    if (strength >= 60) return '▂▄▆_';
    if (strength >= 40) return '▂▄__';
    if (strength >= 20) return '▂___';
    return '____';
  };

  const columnNames = {
    ssid: 'SSID',
    signal: 'Signal',
    security: 'Security',
    channel: 'Channel',
    band: 'Band',
    rate: 'Rate'
  };

  const scanUnavailable = !isScanning && scanError !== null && networks.length === 0;

  const handleSsidChange = (value: string) => {
    updateModel('networkInterface', { wifiSsid: value, interfaceType: 'wifi' });
  };

  const handleSecurityChange = (security: 'none' | 'wep' | 'wpa') => {
    updateModel('networkInterface', {
      wifiSecurity: security,
      wifiPassword: security === 'none' ? null : model.networkInterface.wifiPassword,
    });
  };

  // Show password field when a secured network is selected (via scan or manual entry)
  // Show password when security is not 'none' (null defaults to WPA, matching the radio state)
  const showPassword = model.networkInterface.wifiSecurity !== 'none' &&
    (scanUnavailable || selectedBssid !== null);

  return (
      <Stack hasGutter>
          <StackItem>
              <p>{_("Select a WiFi network to connect to:")}</p>
          </StackItem>

          {isScanning && (
              <StackItem>
                  <Spinner size="md" /> {_("Scanning for WiFi networks...")}
              </StackItem>
          )}

          {!isScanning && (
              <>
                  <StackItem>
                      <Table aria-label="WiFi network selector" variant="compact">
                          <Thead>
                              <Tr>
                                  <Th screenReaderText="Row select" />
                                  <Th>{columnNames.ssid}</Th>
                                  <Th>{columnNames.signal}</Th>
                                  <Th>{columnNames.security}</Th>
                                  <Th>{columnNames.channel}</Th>
                                  <Th>{columnNames.band}</Th>
                                  <Th>{columnNames.rate}</Th>
                              </Tr>
                          </Thead>
                          <Tbody>
                              {networks.map((network) => (
                                  <Tr key={network.bssid}>
                                      <Td>
                                          <Radio
                                              id={`wifi-radio-${network.bssid}`}
                                              name="wifi-network-select"
                                              isChecked={selectedBssid === network.bssid}
                                              onChange={() => handleNetworkSelection(network.bssid)}
                                              aria-label={`Select ${network.ssid}`}
                                          />
                                      </Td>
                                      <Td dataLabel={columnNames.ssid}>{network.ssid}</Td>
                                      <Td dataLabel={columnNames.signal}>
                                          <span style={{ fontFamily: 'monospace', verticalAlign: 'bottom', lineHeight: '1' }}>
                                              {getSignalIcon(network.strength)}
                                          </span>{' '}
                                          {network.strength}%
                                      </Td>
                                      <Td dataLabel={columnNames.security}>{network.security}</Td>
                                      <Td dataLabel={columnNames.channel}>{network.channel}</Td>
                                      <Td dataLabel={columnNames.band}>{network.band}</Td>
                                      <Td dataLabel={columnNames.rate}>{network.rate} Mbps</Td>
                                  </Tr>
                              ))}
                          </Tbody>
                      </Table>
                      <Button variant="link" onClick={handleRescan} icon={<WifiIcon />}>
                          {_("Rescan")}
                      </Button>
                  </StackItem>

                  {scanUnavailable && (
                      <StackItem>
                          <Alert variant="warning" title={_("WiFi scanning unavailable")} isInline>
                              {_("WiFi scanning while in access point mode is unavailable on this hardware.")}
                          </Alert>
                      </StackItem>
                  )}

                  <StackItem>
                      <FormGroup label={_("WiFi Network (SSID)")} isRequired fieldId="wifi-ssid">
                          <TextInput
                              id="wifi-ssid"
                              value={model.networkInterface.wifiSsid || ''}
                              onChange={(_, value) => handleSsidChange(value)}
                              aria-label="WiFi SSID"
                              placeholder={_("Enter network name")}
                          />
                      </FormGroup>
                  </StackItem>
                  <StackItem>
                      <FormGroup label={_("Security")} fieldId="wifi-security">
                          <div style={{ display: 'flex', gap: '1.5rem' }}>
                              <Radio
                                  id="wifi-security-wpa"
                                  name="wifi-security"
                                  label="WPA/WPA2/WPA3"
                                  isChecked={model.networkInterface.wifiSecurity !== 'none'}
                                  onChange={() => handleSecurityChange('wpa')}
                              />
                              <Radio
                                  id="wifi-security-none"
                                  name="wifi-security"
                                  label={_("None (open)")}
                                  isChecked={model.networkInterface.wifiSecurity === 'none'}
                                  onChange={() => handleSecurityChange('none')}
                              />
                          </div>
                      </FormGroup>
                  </StackItem>
                  {showPassword && (
                      <StackItem>
                          <FormGroup label={_("WiFi Password")} isRequired fieldId="wifi-password">
                              <TextInput
                                  type="password"
                                  id="wifi-password"
                                  value={model.networkInterface.wifiPassword || ''}
                                  onChange={(_, value) => handlePasswordChange(value)}
                                  aria-label="WiFi password"
                                  placeholder={_("Enter WiFi password")}
                              />
                          </FormGroup>
                      </StackItem>
                  )}
              </>
          )}
      </Stack>
  );
};

export const NetworkVlanSelector: React.FunctionComponent = () => {
  const { model, updateModel } = useModelContext();

  const setUseVlan = (useVlan: boolean) => {
    if (useVlan) {
      // Enable VLAN with default ID of 1
      updateModel('networkInterface', { vlanId: 1 });
    } else {
      // Disable VLAN by setting to null
      updateModel('networkInterface', { vlanId: null });
    }
  };

  const setVlanId = (vlanId: number) => {
    updateModel('networkInterface', { vlanId });
  };

  const onVlanIdChange = (event: React.FormEvent<HTMLInputElement>) => {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(value) && value >= 1 && value <= 4094) {
      setVlanId(value);
    }
  };

  const onVlanIdMinus = () => {
    if (model.networkInterface.vlanId && model.networkInterface.vlanId > 1) {
      setVlanId(model.networkInterface.vlanId - 1);
    }
  };

  const onVlanIdPlus = () => {
    if (model.networkInterface.vlanId && model.networkInterface.vlanId < 4094) {
      setVlanId(model.networkInterface.vlanId + 1);
    }
  };

  const useVlan = model.networkInterface.vlanId !== null;

  return (
      <div>
          <Checkbox
        id="vlan-checkbox"
        label="VLAN ID"
        isChecked={useVlan}
        onChange={(_, checked) => setUseVlan(checked)}
          />
          {useVlan && (
          <div style={{ marginTop: '1rem', marginLeft: '1.5rem' }}>
              <NumberInput
            value={model.networkInterface.vlanId || 1}
            min={1}
            max={4094}
            onChange={onVlanIdChange}
            onMinus={onVlanIdMinus}
            onPlus={onVlanIdPlus}
            inputName="vlan-id"
            inputAriaLabel="VLAN ID"
            widthChars={5}
              />
          </div>
      )}
      </div>
  );
};
