/* SPDX-License-Identifier: LGPL-2.1-or-later */
import { useEffect, useState } from "react";

import { getCockpitConnectedInterface } from "../services/network";

export function useCockpitConnectedInterface(): {
    cockpitInterface: string | null;
    isResolved: boolean;
} {
    const [cockpitInterface, setCockpitInterface] = useState<string | null>(null);
    const [isResolved, setIsResolved] = useState(false);

    useEffect(() => {
        let cancelled = false;

        getCockpitConnectedInterface().then((result) => {
            if (!cancelled) {
                setCockpitInterface(result);
                setIsResolved(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return { cockpitInterface, isResolved };
}
