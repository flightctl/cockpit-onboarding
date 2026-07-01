import React from "react";

import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText";
import { FormHelperText as PFFormHelperText } from "@patternfly/react-core/dist/esm/components/Form";

const FormHelperText = ({ content, variant }: { content: string; variant?: "default" | "error" | "warning" }) => {
    if (!content) {
        return null;
    }
    return (
        <PFFormHelperText>
            <HelperText>
                <HelperTextItem variant={variant || "default"}>{content}</HelperTextItem>
            </HelperText>
        </PFFormHelperText>
    );
};

export default FormHelperText;
