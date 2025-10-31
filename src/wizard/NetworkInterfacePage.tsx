import React from 'react';

import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { NumberInput } from "@patternfly/react-core/dist/esm/components/NumberInput/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner/index.js";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
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

  const isIfaceSelectable = (iface: import('../../pkg/networkmanager/interfaces.js').Interface) => is_managed(iface.Device); // Use proper NetworkManager logic

  // Initialize selection if not set
  React.useEffect(() => {
    if (!model.networkInterface.selectedInterface) {
      const defaultSelectedInterface = interfaces.find(iface =>
        iface.Device && iface.Device.State === 100 && isIfaceSelectable(iface)
      );
      if (defaultSelectedInterface) {
        updateModel('networkInterface', { selectedInterface: defaultSelectedInterface.Name });
        // Load the network configuration for the default interface
        switchToInterfaceConfig(defaultSelectedInterface.Name);
      }
    }
  }, [interfaces, model.networkInterface.selectedInterface, updateModel, switchToInterfaceConfig]);

  const setSelectedIfaceName = (name: string) => {
    updateModel('networkInterface', { selectedInterface: name });
    // Switch to the configuration of the newly selected interface
    switchToInterfaceConfig(name);
  };

  return (
      <Table aria-label="Network interface selector">
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

  // Scan for WiFi networks when component mounts
  React.useEffect(() => {
    const scanNetworks = async () => {
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

    scanNetworks();
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

      updateModel('networkInterface', {
        wifiSsid: selectedNetwork.ssid,
        wifiSecurity: securityType,
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

  return (
      <Stack hasGutter>
          <StackItem>
              <p>Select a WiFi network to connect to:</p>
          </StackItem>

          {scanError && (
          <StackItem>
              <Alert variant="warning" title="WiFi scan failed" isInline>
                  {scanError}
              </Alert>
          </StackItem>
      )}

          {isScanning
? (
    <StackItem>
        <Spinner size="md" /> Scanning for WiFi networks...
    </StackItem>
      )
: (
    <>
        <StackItem>
            <Table aria-label="WiFi network selector">
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
                Rescan
            </Button>
        </StackItem>

        {selectedBssid && model.networkInterface.wifiSecurity !== 'none' && (
        <StackItem>
            <FormGroup label="WiFi Password" isRequired fieldId="wifi-password">
                <TextInput
                  type="password"
                  id="wifi-password"
                  value={model.networkInterface.wifiPassword || ''}
                  onChange={(_, value) => handlePasswordChange(value)}
                  aria-label="WiFi password"
                  placeholder="Enter WiFi password"
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
