import React from "react";

import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText";
import { FormHelperText } from "@patternfly/react-core/dist/esm/components/Form";

export const ErrorHelperText = ({ error }: { error: string | null | undefined }) => {
    if (!error) {
        return null;
    }
    return (
        <FormHelperText>
            <HelperText>
                <HelperTextItem variant="error">{error}</HelperTextItem>
            </HelperText>
        </FormHelperText>
    );
};

const DefaultHelperText = ({ text }: { text: string }) => {
    return (
        <FormHelperText>
            <HelperText>
                <HelperTextItem variant="default">{text}</HelperTextItem>
            </HelperText>
        </FormHelperText>
    );
};

export default DefaultHelperText;
