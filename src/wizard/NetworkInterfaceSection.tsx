import React from "react";
import cockpit from "cockpit";

import { WifiIcon } from "@patternfly/react-icons";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner/index.js";
import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Label } from "@patternfly/react-core/dist/esm/components/Label/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";

import { SubtleHeading } from "../components/Headings.tsx";
import FeatureSwitch from "../components/FeatureSwitch.tsx";
import ValidatedTextInput from "../components/ValidatedTextInput.tsx";
import NetworkInterfaceModel from "./NetworkInterfaceModel.tsx";

import { useModelContext } from "../model-context.js";
import { mapWifiSecurity } from "../services/network.js";
import { getCurrentWifiConnection, scanWifiNetworks, WifiConnection } from "../services/wifi.js";
import { Device, device_state_text, is_managed, type Interface } from "../../pkg/networkmanager/interfaces.js";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex/Flex";
import { FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/FlexItem";

const _ = cockpit.gettext;

const N_A = _("N/A");

const NetworkInterfaceSection = ({ interfaces }: { interfaces: Interface[] }) => {
    const { model } = useModelContext();

    function hasGroup(iface: Interface) {
        return (
            (iface.Device &&
                iface.Device.ActiveConnection &&
                iface.Device.ActiveConnection.Group &&
                iface.Device.ActiveConnection.Group.Members.length > 0) ||
            (iface.MainConnection && iface.MainConnection.Groups.length > 0)
        );
    }

    const filteredInterfaces = interfaces.filter((iface) => {
        // Skip loopback
        if (iface.Name === "lo" || (iface.Device && iface.Device.DeviceType === "loopback")) {
            return false;
        }

        // Skip members
        if (hasGroup(iface)) {
            return false;
        }

        return true;
    });

    // Find selected interface to check if it's WiFi
    const selectedIface = filteredInterfaces.find((iface) => iface.Name === model.networkInterface.selectedInterface);
    const isWifiSelected = selectedIface?.Device?.DeviceType === "802-11-wireless";

    return (
        <Stack hasGutter>
            <StackItem>
                <Title headingLevel="h2" size="md" className="pf-v6-u-mb-sm">
                    {_("Choose a network interface to use for onboarding")}
                </Title>
                <SubtleHeading
                    text={_(
                        "If you don't see your network on this list, you will need to troubleshoot it and refresh the page."
                    )}
                />
            </StackItem>

            <StackItem>
                <NetworkInterfaceSelector interfaces={filteredInterfaces} />
            </StackItem>

            {!isWifiSelected && (
                <StackItem>
                    <NetworkVlanSelector />
                </StackItem>
            )}

            {isWifiSelected && selectedIface && (
                <StackItem>
                    <NetworkWifiSelector interfaceName={selectedIface.Name} />
                </StackItem>
            )}
        </Stack>
    );
};

const WiredDeviceStatus = ({ device }: { device: Device | null }) => {
    if (device === null || device.DeviceType !== "ethernet") {
        return null;
    }
    if (device.Carrier) {
        return (
            <Label color="green" className="pf-v6-u-ml-sm">
                {_("Connected")}
            </Label>
        );
    }
    return (
        <Label color="orange" className="pf-v6-u-ml-sm">
            {_("No cable detected")}
        </Label>
    );
};

export const NetworkInterfaceSelector = ({ interfaces }: { interfaces: Interface[] }) => {
    const { model, updateModel, switchToInterfaceConfig } = useModelContext();

    const columnNames = {
        name: _("Name"),
        type: _("Type"),
        mac: _("MAC address"),
        model: _("Vendor and model"),
        speed: _("Speed"),
        state: _("State"),
    };

    const isIfaceSelectable = (iface: Interface) => {
        if (!iface.Device) {
            return false;
        }
        if (iface.Device.DeviceType === "802-11-wireless") {
            return true;
        }
        return is_managed(iface.Device);
    };

    // Initialize selection if not set
    React.useEffect(() => {
        if (!model.networkInterface.selectedInterface) {
            const defaultSelectedInterface = interfaces.find(
                (iface) => iface.Device && iface.Device.State === 100 && isIfaceSelectable(iface)
            );
            if (defaultSelectedInterface) {
                const isWifi = defaultSelectedInterface.Device?.DeviceType === "802-11-wireless";
                updateModel("networkInterface", {
                    selectedInterface: defaultSelectedInterface.Name,
                    interfaceType: isWifi ? "wifi" : "ethernet",
                });
                // Load the network configuration for the default interface
                switchToInterfaceConfig(defaultSelectedInterface.Name);
            }
        }
    }, [interfaces, model.networkInterface.selectedInterface, updateModel, switchToInterfaceConfig]);

    const setSelectedIfaceName = (name: string) => {
        // Determine if the selected interface is WiFi
        const selectedIface = interfaces.find((iface) => iface.Name === name);
        const isWifi = selectedIface?.Device?.DeviceType === "802-11-wireless";

        updateModel("networkInterface", {
            selectedInterface: name,
            interfaceType: isWifi ? "wifi" : "ethernet",
            // Clear WiFi-specific fields when switching to non-WiFi interface
            wifiSsid: isWifi ? model.networkInterface.wifiSsid : null,
            wifiPassword: isWifi ? model.networkInterface.wifiPassword : null,
            wifiSecurity: isWifi ? model.networkInterface.wifiSecurity : null,
            vlanId: isWifi ? null : model.networkInterface.vlanId,
        });
        // Switch to the configuration of the newly selected interface
        switchToInterfaceConfig(name);
    };

    return (
        <Table aria-label={_("Network interface selector")} variant="compact" borders={false}>
            <Thead>
                <Tr>
                    <Th screenReaderText={_("Row select")} />
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
                                variant: "radio",
                            }}
                        />
                        <Td dataLabel={columnNames.name}>{iface.Name}</Td>
                        <Td dataLabel={columnNames.type}>{iface.Device?.DeviceType || N_A}</Td>
                        <Td dataLabel={columnNames.mac}>{iface.Device?.HwAddress || N_A}</Td>
                        <Td dataLabel={columnNames.model}>
                            {iface.Device ? <NetworkInterfaceModel device={iface.Device} /> : N_A}
                        </Td>
                        <Td dataLabel={columnNames.speed}>
                            {iface.Device?.Speed ? `${iface.Device.Speed} Mbps` : N_A}
                        </Td>
                        <Td dataLabel={columnNames.state}>
                            {device_state_text(iface.Device)}
                            <WiredDeviceStatus device={iface.Device} />
                        </Td>
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
    band: "2.4 GHz" | "5 GHz" | "unknown";
    rate: number;
    bssid: string;
}

export const NetworkWifiSelector = ({ interfaceName }: NetworkWifiSelectorProps) => {
    const { model, updateModel } = useModelContext();
    const [isScanning, setIsScanning] = React.useState(false);
    const [networks, setNetworks] = React.useState<WifiNetwork[]>([]);
    const [scanError, setScanError] = React.useState<string | null>(null);
    const [selectedBssid, setSelectedBssid] = React.useState<string | null>(null);
    const hasPreSelected = React.useRef(false);
    // Store current connection details in a ref so it can be accessed in handleNetworkSelection
    const currentConnectionRef = React.useRef<WifiConnection | null>(null);

    // Get current WiFi connection details and scan networks
    React.useEffect(() => {
        const initializeWifi = async () => {
            // First, get current connection if any
            let current = null;
            try {
                current = await getCurrentWifiConnection(interfaceName);
                currentConnectionRef.current = current;
            } catch (error) {
                console.error("Failed to get current WiFi connection:", error);
            }

            // Then scan for networks
            setIsScanning(true);
            setScanError(null);
            try {
                const scannedNetworks = await scanWifiNetworks(interfaceName);
                setNetworks(scannedNetworks);

                // If we have a current connection and it's in the scanned list, pre-select it
                if (current && !hasPreSelected.current) {
                    // Try to find by BSSID first (most specific), then by SSID
                    let matchingNetwork = scannedNetworks.find((n) => current.bssid && n.bssid === current.bssid);

                    if (!matchingNetwork) {
                        // If no BSSID match, try to find by SSID (might match a different AP of the same network)
                        matchingNetwork = scannedNetworks.find((n) => n.ssid === current.ssid);
                    }

                    if (matchingNetwork) {
                        // Pre-select the current network
                        setSelectedBssid(matchingNetwork.bssid);

                        // Update model with current network info
                        updateModel("networkInterface", {
                            wifiSsid: matchingNetwork.ssid,
                            wifiSecurity: mapWifiSecurity(matchingNetwork.security),
                            wifiPassword: current.password, // Pre-fill password
                            interfaceType: "wifi",
                        });

                        hasPreSelected.current = true;
                    }
                }
            } catch (error) {
                console.error("WiFi scan failed:", error);
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
        const selectedNetwork = networks.find((n) => n.bssid === bssid);
        if (selectedNetwork) {
            // Check if this is the currently connected network
            const isCurrentNetwork =
                currentConnectionRef.current &&
                (currentConnectionRef.current.bssid === bssid ||
                    currentConnectionRef.current.ssid === selectedNetwork.ssid);

            updateModel("networkInterface", {
                wifiSsid: selectedNetwork.ssid,
                wifiSecurity: mapWifiSecurity(selectedNetwork.security),
                // Pre-fill password if this is the currently connected network
                wifiPassword: isCurrentNetwork ? currentConnectionRef.current!.password : null,
                interfaceType: "wifi",
            });
        }
    };

    const handlePasswordChange = (value: string) => {
        updateModel("networkInterface", { wifiPassword: value });
    };

    const handleRescan = async () => {
        setIsScanning(true);
        setScanError(null);
        try {
            const scannedNetworks = await scanWifiNetworks(interfaceName);
            setNetworks(scannedNetworks);
        } catch (error) {
            console.error("WiFi scan failed:", error);
            setScanError(String(error));
        } finally {
            setIsScanning(false);
        }
    };

    const getSignalIcon = (strength: number) => {
        if (strength >= 80) {
            return "▂▄▆█";
        }
        if (strength >= 60) {
            return "▂▄▆_";
        }
        if (strength >= 40) {
            return "▂▄__";
        }
        if (strength >= 20) {
            return "▂___";
        }
        return "____";
    };

    const columnNames = {
        ssid: _("SSID"),
        signal: _("Signal"),
        security: _("Security"),
        channel: _("Channel"),
        band: _("Band"),
        rate: _("Rate"),
    };

    const scanUnavailable = !isScanning && scanError !== null && networks.length === 0;

    const handleSsidChange = (value: string) => {
        const updates: Partial<typeof model.networkInterface> = { wifiSsid: value, interfaceType: "wifi" };
        if (model.networkInterface.wifiSecurity === null) {
            updates.wifiSecurity = "wpa";
        }
        updateModel("networkInterface", updates);
    };

    const handleSecurityChange = (security: "none" | "wep" | "wpa") => {
        updateModel("networkInterface", {
            wifiSecurity: security,
            wifiPassword: security === "none" ? null : model.networkInterface.wifiPassword,
        });
    };

    // Show password field when a secured network is selected (via scan or manual entry)
    // Show password when security is not 'none' (null defaults to WPA, matching the radio state)
    const showPassword = model.networkInterface.wifiSecurity !== "none" && (scanUnavailable || selectedBssid !== null);

    return (
        <Stack hasGutter>
            <StackItem>
                <Title headingLevel="h3" size="md" className="pf-v6-u-mb-sm">
                    {_("Select a WiFi network to connect to:")}
                </Title>
            </StackItem>

            {isScanning && (
                <StackItem>
                    <Spinner size="md" /> {_("Scanning for WiFi networks...")}
                </StackItem>
            )}

            {!isScanning && (
                <>
                    <StackItem>
                        <Table aria-label={_("WiFi network selector")} variant="compact">
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
                                            <span
                                                style={{
                                                    fontFamily: "monospace",
                                                    verticalAlign: "bottom",
                                                    lineHeight: "1",
                                                }}
                                            >
                                                {getSignalIcon(network.strength)}
                                            </span>{" "}
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
                                value={model.networkInterface.wifiSsid || ""}
                                onChange={(_, value) => handleSsidChange(value)}
                                aria-label={_("WiFi SSID")}
                                placeholder={_("Enter network name")}
                            />
                        </FormGroup>
                    </StackItem>
                    <StackItem>
                        <FormGroup label={_("Security")} fieldId="wifi-security">
                            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                                <FlexItem>
                                    <Radio
                                        id="wifi-security-wpa"
                                        name="wifi-security"
                                        label={_("WPA/WPA2/WPA3")}
                                        isChecked={model.networkInterface.wifiSecurity !== "none"}
                                        onChange={() => handleSecurityChange("wpa")}
                                    />
                                </FlexItem>
                                <FlexItem>
                                    <Radio
                                        id="wifi-security-none"
                                        name="wifi-security"
                                        label={_("None (open)")}
                                        isChecked={model.networkInterface.wifiSecurity === "none"}
                                        onChange={() => handleSecurityChange("none")}
                                    />
                                </FlexItem>
                            </Flex>
                        </FormGroup>
                    </StackItem>
                    {showPassword && (
                        <StackItem>
                            <FormGroup label={_("WiFi Password")} isRequired fieldId="wifi-password">
                                <TextInput
                                    type="password"
                                    id="wifi-password"
                                    value={model.networkInterface.wifiPassword || ""}
                                    onChange={(_, value) => handlePasswordChange(value)}
                                    aria-label={_("WiFi password")}
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

export const NetworkVlanSelector = () => {
    const { model, updateModel } = useModelContext();
    const [useVlan, setUseVlan] = React.useState(false);
    const [vlanError, setVlanError] = React.useState<string | null>(null);

    const setVlanId = (vlanId: number | null) => {
        updateModel("networkInterface", { vlanId });
    };

    const onToggleUseVlan = (useVlan: boolean) => {
        setVlanError(null);
        setUseVlan(useVlan);
    };

    const onVlanIdChange = (_event: React.FormEvent<HTMLInputElement>, valStr: string) => {
        const value = parseInt(valStr, 10);
        if (isNaN(value) || value < 1 || value > 4094) {
            setVlanError(_("VLAN ID must be a number between 1 and 4094"));
            return;
        }
        setVlanError(null);
        setVlanId(value);
    };

    return (
        <FeatureSwitch fieldId="vlan-id" label={_("VLAN ID")} isChecked={useVlan} onToggle={onToggleUseVlan}>
            <FormGroup label={_("VLAN ID")} isRequired fieldId="vlan-id">
                <ValidatedTextInput
                    id="vlan-id"
                    value={model.networkInterface.vlanId || ""}
                    error={vlanError}
                    isRequired
                    placeholder={_("Enter a number from 1-4094")}
                    onChange={onVlanIdChange}
                    helperText={_("Enter the 802.1Q VLAN ID assigned to this port")}
                />
            </FormGroup>
        </FeatureSwitch>
    );
};

export default NetworkInterfaceSection;
