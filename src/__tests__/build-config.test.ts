/* SPDX-License-Identifier: LGPL-2.1-or-later */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyBrandName, DEFAULT_BRAND_NAME, renderConfig } = require("../../scripts/render-config.cjs");

describe("render-config", () => {
    test("applyBrandName uses default brand name", () => {
        const config = {
            version: "1.0",
            flightctl: {
                defaultEndpoint: "",
            },
        };

        const rendered = applyBrandName(config, DEFAULT_BRAND_NAME);

        expect(rendered.brandName).toBe("Flight Control");
    });

    test("applyBrandName substitutes custom brand name", () => {
        const config = {
            version: "1.0",
            flightctl: {
                defaultEndpoint: "",
            },
        };

        const rendered = applyBrandName(config, "Red Hat Edge Manager");

        expect(rendered.brandName).toBe("Red Hat Edge Manager");
    });

    test("renderConfig writes branded config to output path", () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-config-"));
        const outputPath = path.join(tempDir, "config.json");

        try {
            const rendered = renderConfig({
                brandName: "Red Hat Edge Manager",
                sourcePath: "src/config.json",
                outputPath,
            });

            expect(rendered.brandName).toBe("Red Hat Edge Manager");
            expect(fs.existsSync(outputPath)).toBe(true);
            expect(JSON.parse(fs.readFileSync(outputPath, "utf8")).brandName).toBe("Red Hat Edge Manager");
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
