import * as React from "react";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip/index.js";

type WithTooltipProps = {
    showTooltip: boolean;
    content: React.ReactNode;
    children: React.ReactElement;
};

const WithTooltip = ({ showTooltip, content, children }: React.PropsWithChildren<WithTooltipProps>) =>
    showTooltip ? <Tooltip content={content}>{children}</Tooltip> : children;

export default WithTooltip;
