import * as React from "react";
import { Tooltip } from "@patternfly/react-core/dist/esm/components/Tooltip/index.js";

type WithTooltipProps = {
    showTooltip: boolean;
    content: React.ReactNode;
    children: React.ReactElement;
};

const WithTooltip = ({ showTooltip, content, children }: React.PropsWithChildren<WithTooltipProps>) => {
    const triggerRef = React.useRef<HTMLSpanElement>(null);

    if (!showTooltip) {
        return children;
    }

    // Wrap in a shrink-to-fit span so the tooltip anchors to the control text, not the
    // full row width. The wrapper also receives pointer events when the child is disabled.
    return (
        <Tooltip
            content={content}
            triggerRef={triggerRef}
            position="top"
            flipBehavior={["top", "bottom", "top-start", "top-end", "bottom-start", "bottom-end"]}
        >
            <span ref={triggerRef} style={{ display: "inline-block", width: "fit-content" }}>
                {children}
            </span>
        </Tooltip>
    );
};

export default WithTooltip;
