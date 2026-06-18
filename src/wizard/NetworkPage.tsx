import React from "react";
import cockpit from "cockpit";

import { Divider } from "@patternfly/react-core/dist/esm/components/Divider/index.js";
import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";

import { NetworkInterfacePage } from "./NetworkInterfacePage.tsx";
import { NetworkAddressPage } from "./NetworkAddressPage.tsx";
import { NetworkServicesPage } from "./NetworkServicesPage.tsx";

const _ = cockpit.gettext;

interface NetworkPageProps {
    interfaces: import("../../pkg/networkmanager/interfaces.js").Interface[];
}

export const NetworkPage: React.FunctionComponent<NetworkPageProps> = ({ interfaces }) => {
    return (
        <Stack hasGutter>
            <StackItem>
                <Title headingLevel="h3" size="lg">
                    {_("Network interface")}
                </Title>
            </StackItem>
            <StackItem>
                <NetworkInterfacePage interfaces={interfaces} />
            </StackItem>

            <StackItem>
                <Divider component="div" />
            </StackItem>

            <StackItem>
                <Title headingLevel="h3" size="lg">
                    {_("Network address")}
                </Title>
            </StackItem>
            <StackItem>
                <NetworkAddressPage />
            </StackItem>

            <StackItem>
                <Divider component="div" />
            </StackItem>

            <StackItem>
                <Title headingLevel="h3" size="lg">
                    {_("Network services")}
                </Title>
            </StackItem>
            <StackItem>
                <NetworkServicesPage />
            </StackItem>
        </Stack>
    );
};
