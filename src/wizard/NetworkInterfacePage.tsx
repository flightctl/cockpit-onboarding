import React from 'react';

import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { NumberInput } from "@patternfly/react-core/dist/esm/components/NumberInput/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table';
import { useModelContext } from '../model-context';

import {
    device_state_text,
    is_managed,
} from '../interfaces.js';

interface NetworkInterfacePageProps {
    interfaces: import('../interfaces.js').Interface[];
    operationInProgress?: boolean;
}

export const NetworkInterfacePage: React.FunctionComponent<NetworkInterfacePageProps> = ({ interfaces }) => {

    function hasGroup(iface: import('../interfaces.js').Interface) {
        return ((iface.Device &&
                 iface.Device.ActiveConnection &&
                 iface.Device.ActiveConnection.Group &&
                 iface.Device.ActiveConnection.Group.Members.length > 0) ||
                (iface.MainConnection &&
                 iface.MainConnection.Groups.length > 0));
    }

    const filteredInterfaces = interfaces.filter(iface => {
        // Skip loopback
        if (iface.Name == "lo" || (iface.Device && iface.Device.DeviceType == 'loopback'))
            return false;

        // Skip members
        if (hasGroup(iface))
            return false;

        return true;
    });

    return (
      <Stack hasGutter>
        <StackItem>
            <p>Choose a network interface to use for onboarding:</p>
            <NetworkInterfaceSelector interfaces={filteredInterfaces} />
        </StackItem>
        <StackItem>
            <p>Optionally, specify the VLAN ID to use on this interface:</p>
            <NetworkVlanSelector />
        </StackItem>
      </Stack>
    );
};

interface NetworkInterfaceSelectorProps {
  interfaces: import('../interfaces.js').Interface[];
}

export const NetworkInterfaceSelector: React.FunctionComponent<NetworkInterfaceSelectorProps> = ({ interfaces }) => {
  const { model: model, updateModel: updateModel, switchToInterfaceConfig } = useModelContext();
  
  const columnNames = {
    name: 'Name',
    type: 'Type',
    mac: 'MAC address',
    model: 'Vendor and model',
    speed: 'Speed',
    state: 'State'
  };

  const isIfaceSelectable = (iface: import('../interfaces.js').Interface) => is_managed(iface.Device); // Use proper NetworkManager logic

  // Initialize selection if not set
  React.useEffect(() => {
    if (!model.networkInterface.selectedInterface) {
      const defaultSelectedInterface = interfaces.find(iface => 
        iface.Device && iface.Device.State === 100 && isIfaceSelectable(iface)
      );
      if (defaultSelectedInterface) {
        updateModel('networkInterface', { selectedInterface: defaultSelectedInterface.Name });
      }
    }
  }, [interfaces, model.networkInterface.selectedInterface, updateModel]);
  
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

export const NetworkVlanSelector: React.FunctionComponent = () => {
  const { model: model, updateModel: updateModel } = useModelContext();
  
  const setUseVlan = (useVlan: boolean) => {
    updateModel('networkInterface', { useVlan });
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

  return (
    <div>
      <Checkbox
        id="vlan-checkbox"
        label="VLAN ID"
        isChecked={model.networkInterface.useVlan}
        onChange={(_, checked) => setUseVlan(checked)}
      />
      {model.networkInterface.useVlan && (
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
