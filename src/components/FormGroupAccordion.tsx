import React from "react";

import { FormHelperText } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText/index.js";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionToggle,
} from "@patternfly/react-core/dist/esm/components/Accordion/index.js";

export interface FormGroupAccordionProps {
    id: string;
    toggleLabel: React.ReactNode;
    helperText?: React.ReactNode;
    error?: string | null;
}

/**
 * Accordion for a field or a field group with common styles.
 */
const FormGroupAccordion = ({
    id,
    toggleLabel,
    helperText,
    error,
    children,
}: React.PropsWithChildren<FormGroupAccordionProps>) => {
    const [isExpanded, setIsExpanded] = React.useState(true);
    const showHelper = error || helperText;

    return (
        <Accordion asDefinitionList={false}>
            <AccordionItem isExpanded={isExpanded}>
                <AccordionToggle id={`${id}-toggle`} onClick={() => setIsExpanded(!isExpanded)} component="div">
                    {toggleLabel}
                </AccordionToggle>
                <AccordionContent id={`${id}-content`} aria-labelledby={`${id}-toggle`}>
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
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export default FormGroupAccordion;
