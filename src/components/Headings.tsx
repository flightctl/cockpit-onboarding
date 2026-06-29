import React from "react";

import { Content } from "@patternfly/react-core/dist/esm/components/Content/index";

// Headings that don't align too well to PatternFly standards or require multiple jumps in "h*" levels.

export const SubtleHeading = ({ text }: { text: string }) => {
    return <Content className="pf-v6-u-text-color-subtle">{text}</Content>;
};

export const LabelHeading = ({ text }: { text: string }) => {
    return <Content className="pf-v6-c-form__label-text pf-v6-u-font-weight-bold">{text}</Content>;
};
