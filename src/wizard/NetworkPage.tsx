import React from "react";
import cockpit from "cockpit";

import { Divider } from "@patternfly/react-core/dist/esm/components/Divider/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";

import { Interface } from "../../pkg/networkmanager/interfaces.js";
import SelectedNetworkInterfaceAlert from "./SelectedNetworkInterfaceAlert";
import NetworkInterfaceSection from "./NetworkInterfaceSection";
import NetworkAddressSection from "./NetworkAddressSection";
import NetworkServicesSection from "./NetworkServicesSection";

const _ = cockpit.gettext;

interface NetworkPageProps {
    interfaces: Interface[];
}

export const NetworkPage = ({ interfaces }: NetworkPageProps) => {
    return (
        <Stack hasGutter>
            <StackItem>
                <Title headingLevel="h1" size="2xl">
                    {_("Network")}
                </Title>
            </StackItem>

            <StackItem>
                <SelectedNetworkInterfaceAlert />
            </StackItem>

            <StackItem>
                <NetworkInterfaceSection interfaces={interfaces} />
            </StackItem>

            <StackItem>
                <Divider />
            </StackItem>

            <StackItem>
                <NetworkAddressSection />
            </StackItem>

            <StackItem>
                <Divider />
            </StackItem>

            <StackItem>
                <NetworkServicesSection />
            </StackItem>
        </Stack>
    );
};
