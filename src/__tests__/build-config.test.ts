import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyBrandName, DEFAULT_BRAND_NAME, renderConfig } = require("../../scripts/render-config.cjs");

describe("render-config", () => {
    test("applyBrandName uses default brand name for flightctl enrollment service", () => {
        const config = {
            version: "1.0",
            enrollmentServices: [
                {
                    id: "flightctl",
                    name: "placeholder",
                    description: "placeholder description",
                },
            ],
        };

        const rendered = applyBrandName(config, DEFAULT_BRAND_NAME);

        expect(rendered.brandName).toBe("Flight Control");
        expect(rendered.enrollmentServices[0].name).toBe("Flight Control");
        expect(rendered.enrollmentServices[0].description).toBe(
            "Flight Control allows you to manage your edge environment at scale."
        );
    });

    test("applyBrandName substitutes custom brand name", () => {
        const config = {
            version: "1.0",
            enrollmentServices: [{ id: "flightctl", name: "placeholder", description: "placeholder" }],
        };

        const rendered = applyBrandName(config, "Red Hat Edge Manager");

        expect(rendered.brandName).toBe("Red Hat Edge Manager");
        expect(rendered.enrollmentServices[0].name).toBe("Red Hat Edge Manager");
        expect(rendered.enrollmentServices[0].description).toBe(
            "Red Hat Edge Manager allows you to manage your edge environment at scale."
        );
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
            expect(JSON.parse(fs.readFileSync(outputPath, "utf8")).enrollmentServices[0].name).toBe(
                "Red Hat Edge Manager"
            );
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
