// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function waitForProxy(proxy: any): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        proxy.wait(() => {
            if (proxy.valid) {
                resolve();
            } else {
                reject(new Error('Failed to connect to D-Bus proxy'));
            }
        });
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function waitForProxyWithTimeout(proxy: any, timeoutMs: number): Promise<void> {
    await Promise.race([
        waitForProxy(proxy),
        new Promise<void>((_resolve, reject) => {
            setTimeout(() => reject(new Error('Timeout waiting for D-Bus proxy')), timeoutMs);
        })
    ]);
}
