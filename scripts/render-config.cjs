const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_BRAND_NAME = "Flight Control";
const CONFIG_SOURCE = "src/config.json";
const CONFIG_OUTPUT = "dist/config.json";

function applyBrandName(config, brandName) {
    const rendered = JSON.parse(JSON.stringify(config));
    rendered.brandName = brandName;
    for (const svc of rendered.enrollmentServices ?? []) {
        if (svc.id === "flightctl") {
            svc.name = brandName;
            svc.description = `Enroll this device into ${brandName} fleet management`;
        }
    }
    return rendered;
}

function renderConfig({
    brandName = (process.env.BRAND_NAME || DEFAULT_BRAND_NAME).trim(),
    sourcePath = CONFIG_SOURCE,
    outputPath = CONFIG_OUTPUT,
} = {}) {
    const config = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const rendered = applyBrandName(config, brandName);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(rendered, null, 2)}\n`);
    return rendered;
}

module.exports = {
    DEFAULT_BRAND_NAME,
    applyBrandName,
    renderConfig,
};
