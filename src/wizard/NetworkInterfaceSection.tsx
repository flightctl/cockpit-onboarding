import React from "react";
import cockpit from "cockpit";

import { Bullseye } from "@patternfly/react-core/dist/esm/layouts/Bullseye/Bullseye";
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { EmptyState, EmptyStateVariant } from "@patternfly/react-core/dist/esm/components/EmptyState/index.js";
import { EmptyStateBody } from "@patternfly/react-core/dist/esm/components/EmptyState/index.js";
import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex/Flex";
import { FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/FlexItem";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Icon } from "@patternfly/react-core/dist/esm/components/Icon/Icon";
import { Label } from "@patternfly/react-core/dist/esm/components/Label/index.js";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { Spinner } from "@patternfly/react-core/dist/esm/components/Spinner/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { Table, Thead, Tr, Th, Tbody, Td } from "@patternfly/react-table";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { WifiIcon } from "@patternfly/react-icons";

import { SubtleHeading } from "../components/Headings.tsx";
import FeatureSwitch from "../components/FeatureSwitch.tsx";
import ValidatedTextInput from "../components/ValidatedTextInput.tsx";
import WithTooltip from "../components/WithTooltip.tsx";
import NetworkInterfaceModel from "./NetworkInterfaceModel.tsx";

import { useModelContext } from "../model-context.js";
import { mapWifiSecurity } from "../services/network.js";
import { validateVlanConfig } from "../validation.js";
import { getCurrentWifiConnection, scanWifiNetworks, WifiConnection, WifiNetwork } from "../services/wifi.js";
import { Device, device_state_text, is_managed, type Interface } from "../../pkg/networkmanager/interfaces.js";
import type { WifiBand } from "../types.js";

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
                    <NetworkWifiSelector key={selectedIface.Name} interfaceName={selectedIface.Name} />
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
            wifiSsid: isWifi ? model.networkInterface.wifiSsid : null,
            wifiPassword: isWifi ? model.networkInterface.wifiPassword : null,
            wifiSecurity: isWifi ? model.networkInterface.wifiSecurity : null,
            wifiBand: isWifi ? model.networkInterface.wifiBand : null,
            vlanEnabled: isWifi ? false : model.networkInterface.vlanEnabled,
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

const WifiEmptyStateIcon = () => (
    <Icon size="lg">
        <WifiIcon />
    </Icon>
);

const SIGNAL_BARS = ["▂", "▄", "▆", "█"] as const;

const SignalStrengthIcon = ({ strength }: { strength: number }) => {
    const barCount = Math.min(4, Math.max(0, Math.floor(strength / 20)));
    const icon = SIGNAL_BARS.map((bar, i) => (i < barCount ? bar : "_")).join("");

    return (
        <Flex>
            <FlexItem style={{ fontFamily: "monospace", lineHeight: 1 }}>{icon}</FlexItem>
            <FlexItem>{strength}%</FlexItem>
        </Flex>
    );
};

export const NetworkWifiSelector = ({ interfaceName }: NetworkWifiSelectorProps) => {
    const { model, updateModel } = useModelContext();
    const [isScanning, setIsScanning] = React.useState(true);
    const [networks, setNetworks] = React.useState<WifiNetwork[]>([]);
    const [scanError, setScanError] = React.useState<string | null>(null);
    const hasPreSelected = React.useRef(false);
    // Store current connection details in a ref so it can be accessed in handleNetworkSelection
    const currentConnectionRef = React.useRef<WifiConnection | null>(null);

    // Get current WiFi connection details and scan networks
    React.useEffect(() => {
        let cancelled = false;

        hasPreSelected.current = false;
        currentConnectionRef.current = null;
        setIsScanning(true);
        setNetworks([]);
        setScanError(null);

        const initializeWifi = async () => {
            // First, get current connection if any
            let current = null;
            try {
                current = await getCurrentWifiConnection(interfaceName);
                if (cancelled) {
                    return;
                }
                currentConnectionRef.current = current;
            } catch (error) {
                console.error("Failed to get current WiFi connection:", error);
            }

            if (cancelled) {
                return;
            }

            // Then scan for networks
            try {
                const scannedNetworks = await scanWifiNetworks(interfaceName);
                if (cancelled) {
                    return;
                }
                setNetworks(scannedNetworks);

                if (current && !hasPreSelected.current) {
                    const matchingNetwork = scannedNetworks.find((n) => n.ssid === current.ssid);

                    if (matchingNetwork) {
                        updateModel("networkInterface", {
                            wifiSsid: matchingNetwork.ssid,
                            wifiSecurity: mapWifiSecurity(matchingNetwork.security),
                            wifiPassword: current.password,
                            interfaceType: "wifi",
                        });

                        hasPreSelected.current = true;
                    }
                }
            } catch (error) {
                if (cancelled) {
                    return;
                }
                console.error("WiFi scan failed:", error);
                setScanError(String(error));
            } finally {
                if (!cancelled) {
                    setIsScanning(false);
                }
            }
        };

        initializeWifi();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interfaceName]);

    const handleNetworkSelection = (ssid: string) => {
        const network = networks.find((n) => n.ssid === ssid);
        if (network) {
            const isCurrentNetwork = currentConnectionRef.current && currentConnectionRef.current.ssid === ssid;

            updateModel("networkInterface", {
                wifiSsid: network.ssid,
                wifiSecurity: mapWifiSecurity(network.security),
                wifiPassword: isCurrentNetwork ? currentConnectionRef.current!.password : null,
                wifiBand: network.bands.length > 1 ? model.networkInterface.wifiBand : null,
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

    const columnNames = {
        ssid: _("SSID"),
        signal: _("Signal"),
        security: _("Security"),
        band: _("Band"),
    };

    const selectedSsid = model.networkInterface.wifiSsid;
    const selectedNetwork = selectedSsid ? networks.find((n) => n.ssid === selectedSsid) : null;
    const selectedHasDualBand = selectedNetwork ? selectedNetwork.bands.length > 1 : false;

    const scanUnavailable = !isScanning && scanError !== null && networks.length === 0;

    const handleSsidChange = (value: string) => {
        const updates: Partial<typeof model.networkInterface> = { wifiSsid: value, interfaceType: "wifi" };
        if (model.networkInterface.wifiSecurity === null) {
            updates.wifiSecurity = "wpa";
        }
        updateModel("networkInterface", updates);
    };

    const handleSecurityToggle = (enabled: boolean) => {
        updateModel("networkInterface", {
            wifiSecurity: enabled ? "wpa" : "none",
            wifiPassword: enabled ? model.networkInterface.wifiPassword : null,
        });
    };

    const handleBandChange = (band: WifiBand) => {
        updateModel("networkInterface", { wifiBand: band });
    };

    const showPasswordField = scanUnavailable || selectedSsid !== null;

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
                        <Table aria-label={_("WiFi network selector")} variant="compact" borders={false}>
                            <Thead>
                                <Tr>
                                    <Th
                                        screenReaderText={_("Row select")}
                                        modifier="fitContent"
                                        className="pf-v6-c-table__check"
                                        style={{ maxWidth: "2.5rem" }}
                                    />
                                    <Th>{columnNames.ssid}</Th>
                                    <Th>{columnNames.signal}</Th>
                                    <Th>{columnNames.security}</Th>
                                    <Th>{columnNames.band}</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {networks.map((network) => (
                                    <Tr key={network.ssid}>
                                        <Td
                                            modifier="fitContent"
                                            className="pf-v6-c-table__check"
                                            style={{ maxWidth: "2.5rem", verticalAlign: "middle" }}
                                        >
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="wifi-network-select"
                                                    checked={model.networkInterface.wifiSsid === network.ssid}
                                                    onChange={() => handleNetworkSelection(network.ssid)}
                                                    aria-label={_("Select network $0", network.ssid)}
                                                />
                                            </label>
                                        </Td>
                                        <Td dataLabel={columnNames.ssid}>{network.ssid}</Td>
                                        <Td dataLabel={columnNames.signal}>
                                            <SignalStrengthIcon strength={network.strength} />
                                        </Td>
                                        <Td dataLabel={columnNames.security}>{network.security}</Td>
                                        <Td dataLabel={columnNames.band}>
                                            {network.bands.join(" / ") || _("Unknown")}
                                        </Td>
                                    </Tr>
                                ))}
                                {networks.length === 0 && (
                                    <Tr>
                                        <Td
                                            modifier="fitContent"
                                            className="pf-v6-c-table__check"
                                            style={{ maxWidth: "2.5rem" }}
                                        />
                                        <Td colSpan={4}>
                                            <Bullseye>
                                                <EmptyState
                                                    titleText={_("No WiFi networks found")}
                                                    headingLevel="h3"
                                                    variant={EmptyStateVariant.xs}
                                                    icon={WifiEmptyStateIcon}
                                                >
                                                    <EmptyStateBody>
                                                        {_(
                                                            "Ensure the network is powered on and the device is connected to the network."
                                                        )}
                                                    </EmptyStateBody>
                                                </EmptyState>
                                            </Bullseye>
                                        </Td>
                                    </Tr>
                                )}
                            </Tbody>
                        </Table>
                    </StackItem>

                    <StackItem>
                        <WithTooltip
                            showTooltip={isScanning || scanUnavailable}
                            content={
                                isScanning
                                    ? _("Scanning...")
                                    : _("WiFi scanning while in access point mode is unavailable on this hardware.")
                            }
                        >
                            <Button
                                variant="link"
                                onClick={handleRescan}
                                icon={<WifiIcon />}
                                isDisabled={isScanning || scanUnavailable}
                            >
                                {_("Rescan")}
                            </Button>
                        </WithTooltip>
                    </StackItem>

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
                        <FeatureSwitch
                            fieldId="wifi-security"
                            label={_("Use WPA/WPA2/WPA3 security")}
                            isChecked={model.networkInterface.wifiSecurity !== "none"}
                            onToggle={handleSecurityToggle}
                        >
                            {showPasswordField && (
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
                            )}
                        </FeatureSwitch>
                    </StackItem>
                    {selectedHasDualBand && (
                        <StackItem>
                            <FormGroup label={_("Band preference")} fieldId="wifi-band">
                                <Flex>
                                    <FlexItem>
                                        <Radio
                                            id="wifi-band-auto"
                                            name="wifi-band"
                                            label={_("Auto")}
                                            isChecked={
                                                !model.networkInterface.wifiBand ||
                                                model.networkInterface.wifiBand === "auto"
                                            }
                                            onChange={() => handleBandChange("auto")}
                                        />
                                    </FlexItem>
                                    <FlexItem>
                                        <Radio
                                            id="wifi-band-24"
                                            name="wifi-band"
                                            label={_("2.4 GHz")}
                                            isChecked={model.networkInterface.wifiBand === "bg"}
                                            onChange={() => handleBandChange("bg")}
                                        />
                                    </FlexItem>
                                    <FlexItem>
                                        <Radio
                                            id="wifi-band-5"
                                            name="wifi-band"
                                            label={_("5 GHz")}
                                            isChecked={model.networkInterface.wifiBand === "a"}
                                            onChange={() => handleBandChange("a")}
                                        />
                                    </FlexItem>
                                </Flex>
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
    const [vlanInputError, setVlanInputError] = React.useState<string | null>(null);
    const useVlan = model.networkInterface.vlanEnabled;
    const vlanError =
        vlanInputError ?? validateVlanConfig(model.networkInterface.vlanEnabled, model.networkInterface.vlanId);

    const onToggleUseVlan = (enabled: boolean) => {
        setVlanInputError(null);
        updateModel("networkInterface", {
            vlanEnabled: enabled,
            vlanId: enabled ? model.networkInterface.vlanId : null,
        });
    };

    const onVlanIdChange = (_event: React.FormEvent<HTMLInputElement>, valStr: string) => {
        if (!valStr.trim()) {
            setVlanInputError(null);
            updateModel("networkInterface", { vlanId: null });
            return;
        }

        const value = parseInt(valStr, 10);
        if (isNaN(value) || value < 1 || value > 4094) {
            setVlanInputError(_("VLAN ID must be a number between 1 and 4094"));
            updateModel("networkInterface", { vlanId: null });
            return;
        }

        setVlanInputError(null);
        updateModel("networkInterface", { vlanId: value });
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
