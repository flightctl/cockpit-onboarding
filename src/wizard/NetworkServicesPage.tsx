import React from "react";
import cockpit from "cockpit";

import { Title } from "@patternfly/react-core/dist/esm/components/Title/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";

import NetworkServicesSection from "./NetworkServicesSection.js";
import { SubtleHeading } from "../components/Headings.js";

const _ = cockpit.gettext;

export const NetworkServicesPage = () => {
    return (
        <Stack hasGutter>
            <StackItem>
                <Title headingLevel="h1" size="2xl">
                    {_("Network services")}
                </Title>
            </StackItem>
            <StackItem>
                <SubtleHeading text={_("Configure optional network services for your system")} />
            </StackItem>

            <StackItem>
                <NetworkServicesSection />
            </StackItem>
        </Stack>
    );
};
