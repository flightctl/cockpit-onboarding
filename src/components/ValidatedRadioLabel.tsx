/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from "react";
import cockpit from "cockpit";

import { Flex } from "@patternfly/react-core/dist/esm/layouts/Flex/Flex";
import { FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex";
import { Icon } from "@patternfly/react-core/dist/esm/components/Icon";
import ExclamationTriangleIcon from "@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip";

const _ = cockpit.gettext;

const ValidatedRadioLabel = ({ label, isValid = false }: { label: string; isValid: boolean }) => {
    if (isValid) {
        return label;
    }

    return (
        <Flex>
            <FlexItem>{label}</FlexItem>
            <FlexItem>
                <Tooltip content={_("The current configuration is either incomplete or invalid.")}>
                    <Icon status="warning">
                        <ExclamationTriangleIcon />
                    </Icon>
                </Tooltip>
            </FlexItem>
        </Flex>
    );
};

export default ValidatedRadioLabel;
