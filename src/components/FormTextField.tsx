import React from "react";

import { FormGroup, FormHelperText } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText/index.js";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionToggle,
} from "@patternfly/react-core/dist/esm/components/Accordion/index.js";

export interface AccordionFormFieldProps {
    fieldId: string;
    toggleLabel: React.ReactNode;
    fieldLabel: React.ReactNode;
    isRequired?: boolean;
    helperText?: React.ReactNode;
    error?: string | null;
}

/**
 * Optional wizard field pattern: collapsed by default, expands to reveal a labeled input.
 * Use for settings that most users can skip but some need to configure.
 */
export const FormTextField = ({
    fieldId,
    toggleLabel,
    fieldLabel,
    isRequired = false,
    helperText,
    error,
    children,
}: React.PropsWithChildren<AccordionFormFieldProps>) => {
    const [isExpanded, setIsExpanded] = React.useState(true);
    const showHelper = error || helperText;

    return (
        <Accordion asDefinitionList={false}>
            <AccordionItem isExpanded={isExpanded}>
                <AccordionToggle id={`${fieldId}-toggle`} onClick={() => setIsExpanded(!isExpanded)} component="div">
                    {toggleLabel}
                </AccordionToggle>
                <AccordionContent id={`${fieldId}-content`} aria-labelledby={`${fieldId}-toggle`}>
                    <FormGroup fieldId={fieldId} label={fieldLabel} isRequired={isRequired} isStack>
                        {children}
                        {showHelper && (
                            <FormHelperText>
                                <HelperText>
                                    {error ? (
                                        <HelperTextItem variant="error">{error}</HelperTextItem>
                                    ) : (
                                        <HelperTextItem>{helperText}</HelperTextItem>
                                    )}
                                </HelperText>
                            </FormHelperText>
                        )}
                    </FormGroup>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};
