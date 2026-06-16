import cockpit from "cockpit";

/**
 * Create a temp file with 0600 permissions atomically via mktemp, then write
 * content into the already-restricted file. This avoids TOCTOU races where
 * a file is created world-readable and then chmod'd.
 */
export async function createSecureTempFile(content: string, prefix = ".params-"): Promise<string> {
    const tmpPath = (await cockpit.spawn(["mktemp", `/tmp/${prefix}XXXXXX.json`], { err: "message" })).trim();
    await cockpit.file(tmpPath).replace(content);
    return tmpPath;
}

export async function spawnWithParamsFile(
    scriptPath: string,
    params: unknown,
    tmpPrefix = ".params-"
): Promise<string> {
    const tmpPath = await createSecureTempFile(JSON.stringify(params), tmpPrefix);
    try {
        return await cockpit.spawn(["sudo", scriptPath, tmpPath], { err: "message" });
    } finally {
        cockpit.spawn(["rm", "-f", tmpPath], { err: "message" }).catch(() => {});
    }
}
