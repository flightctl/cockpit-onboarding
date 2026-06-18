import * as React from "react";
import { Card, CardBody, Divider, Flex, FlexItem, Switch, Title } from "@patternfly/react-core";

type FeatureSwitchProps = {
    fieldId: string;
    label: React.ReactNode;
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
                    <Title headingLevel="h4">{label}</Title>
                </FlexItem>
                <FlexItem>
                    <Switch
                        id={fieldId}
                        label={label}
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
