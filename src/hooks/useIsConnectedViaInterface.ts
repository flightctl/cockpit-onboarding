import { useEffect, useState } from "react";

import { isConnectedViaInterface } from "../services/network";

export function useIsConnectedViaInterface(selectedInterface: string | null | undefined): boolean {
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        let cancelled = false;

        if (!selectedInterface) {
            setIsConnected(false);
            return;
        }

        isConnectedViaInterface(selectedInterface).then((result) => {
            if (!cancelled) {
                setIsConnected(result);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [selectedInterface]);

    return isConnected;
}
