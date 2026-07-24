/* SPDX-License-Identifier: LGPL-2.1-or-later */
import React from "react";
import { Truncate } from "@patternfly/react-core/dist/esm/components/Truncate/index.js";

import { Device } from "../../pkg/networkmanager/interfaces";

const NetworkInterfaceModel = ({ device }: { device: Device }) => {
    const content =
        device.IdVendor && device.IdModel
            ? `${device.IdVendor} ${device.IdModel}`
            : device.IdModel || device.IdVendor || "";

    if (!content) {
        return null;
    }

    return <Truncate maxCharsDisplayed={20} content={content} />;
};

export default NetworkInterfaceModel;
