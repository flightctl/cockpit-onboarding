/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from "react";

import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText";
import { FormHelperText as PFFormHelperText } from "@patternfly/react-core/dist/esm/components/Form";

const FormHelperText = ({ id, content, variant }: { id?: string; content: string; variant?: "default" | "error" | "warning" }) => {
    if (!content) {
        return null;
    }
    return (
        <PFFormHelperText>
            <HelperText>
                <HelperTextItem {...(id && { id })} variant={variant || "default"}>{content}</HelperTextItem>
            </HelperText>
        </PFFormHelperText>
    );
};

export default FormHelperText;
