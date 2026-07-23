/* SPDX-License-Identifier: LGPL-2.1-or-later */
import cockpit from "cockpit";

type AwaitableDBusProxy = cockpit.DBusProxy & {
    wait(callback?: () => void): void;
};

export type DBusProxyWithData<TData> = AwaitableDBusProxy & {
    data: TData;
    call(method: string, args?: unknown[]): Promise<unknown[]>;
};

export async function waitForProxy<TData = Record<string, unknown>>(
    proxy: cockpit.DBusProxy
): Promise<DBusProxyWithData<TData>> {
    const awaitable = proxy as AwaitableDBusProxy;

    await new Promise<void>((resolve, reject) => {
        awaitable.wait(() => {
            if (awaitable.valid) {
                resolve();
            } else {
                reject(new Error("Failed to connect to D-Bus proxy"));
            }
        });
    });

    return proxy as DBusProxyWithData<TData>;
}

export async function waitForProxyWithTimeout<TData = Record<string, unknown>>(
    proxy: cockpit.DBusProxy,
    timeoutMs: number
): Promise<DBusProxyWithData<TData>> {
    await Promise.race([
        waitForProxy<TData>(proxy),
        new Promise<void>((_resolve, reject) => {
            setTimeout(() => reject(new Error("Timeout waiting for D-Bus proxy")), timeoutMs);
        }),
    ]);

    return proxy as DBusProxyWithData<TData>;
}
