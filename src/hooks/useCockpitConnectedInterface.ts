/* SPDX-License-Identifier: LGPL-2.1-or-later */
import { useEffect, useState } from "react";

import { getCockpitConnectedInterfaces } from "../services/network";

export function useCockpitConnectedInterface(): {
    cockpitInterfaces: string[];
    isResolved: boolean;
} {
    const [cockpitInterfaces, setCockpitInterfaces] = useState<string[]>([]);
    const [isResolved, setIsResolved] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getCockpitConnectedInterfaces().then((result) => {
            if (!cancelled) {
                setCockpitInterfaces(result);
                setIsResolved(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return { cockpitInterfaces, isResolved };
}
