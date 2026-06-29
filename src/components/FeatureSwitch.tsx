import * as React from "react";
import { Card, CardBody, Divider, Switch } from "@patternfly/react-core/dist/esm/components/index.js";
import { Flex, FlexItem } from "@patternfly/react-core/dist/esm/layouts/Flex/index.js";

import { LabelHeading } from "./Headings";

type FeatureSwitchProps = {
    fieldId: string;
    label: string;
    isChecked: boolean;
    isDisabled?: boolean;
    onToggle: (checked: boolean) => void;
};

/** On/off gate for optional wizard sections. Off by default; children render only when on. */
const FeatureSwitch = ({
    fieldId,
    label,
    isChecked,
    onToggle,
    isDisabled = false,
    children,
}: React.PropsWithChildren<FeatureSwitchProps>) => (
    <Card isCompact>
        <CardBody>
            <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
                <FlexItem>
                    <LabelHeading text={label} />
                </FlexItem>
                <FlexItem>
                    <Switch
                        id={fieldId}
                        aria-label={label}
                        isChecked={isChecked}
                        isDisabled={isDisabled}
                        onChange={(_event, checked) => onToggle(checked)}
                    />
                </FlexItem>
            </Flex>

            {isChecked && children ? (
                <>
                    <Divider className="pf-v6-u-my-md" role="separator" />
                    {children}
                </>
            ) : null}
        </CardBody>
    </Card>
);

export default FeatureSwitch;
