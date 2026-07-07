import React, { useState, useEffect } from "react";
import cockpit from "cockpit";

import { Alert } from "@patternfly/react-core/dist/esm/components/Alert/index.js";

import { useModelContext } from "../model-context";
import { isConnectedViaInterface } from "../services/network";
import { Interface } from "../../pkg/networkmanager/interfaces";

const _ = cockpit.gettext;

const isEthernetNoCable = (selectedIface: Interface) => {
    return selectedIface.Device?.DeviceType === "ethernet" && selectedIface.Device?.Carrier === false;
};

const SetupInterfaceAlert = ({ isWifi }: { isWifi: boolean }) => {
    const message = isWifi
        ? _(
              "Applying network changes to this interface will disconnect your browser session. The wizard will continue in the background and roll back if enrollment fails."
          )
        : _(
              "Applying network changes to this interface will disconnect your browser session. After applying, unplug the ethernet cable from this device and connect it to your production network. The wizard will wait up to 5 minutes for the new connection before rolling back."
          );
    return (
        <Alert variant="warning" isInline title={_("You are currently connected through this interface")}>
            {message}
        </Alert>
    );
};

const SelectedNetworkInterfaceAlert = () => {
    const { model, networkManager } = useModelContext();

    const interfaces = networkManager?.list_interfaces?.() || [];
    const selectedIface = interfaces.find((iface) => iface.Name === model.networkInterface.selectedInterface);

    const [isSetupIface, setIsSetupIface] = useState(false);

    useEffect(() => {
        if (model.networkInterface.selectedInterface) {
            isConnectedViaInterface(model.networkInterface.selectedInterface).then(setIsSetupIface);
        } else {
            setIsSetupIface(false);
        }
    }, [model.networkInterface.selectedInterface]);

    if (!selectedIface) {
        return null;
    }

    if (isSetupIface) {
        return <SetupInterfaceAlert isWifi={selectedIface?.Device?.DeviceType === "802-11-wireless"} />;
    }

    if (isEthernetNoCable(selectedIface)) {
        return (
            <Alert variant="warning" isInline title={_("No cable detected on selected interface")}>
                {_(
                    "The selected ethernet interface does not have a cable connected. Plug in a network cable before proceeding, or select a different interface."
                )}
            </Alert>
        );
    }
    return null;
};

export default SelectedNetworkInterfaceAlert;
