import React, { useRef, useEffect } from "react";
import cockpit from "cockpit";

import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";

import FormHelperText from "../components/HelperTexts";
import { useModelContext } from "../model-context";
import { useConfig } from "../app";

const _ = cockpit.gettext;

export const ConnectivityTestPage = () => {
    const { model, updateModel } = useModelContext();
    const { config } = useConfig();
    const userEditedRef = useRef(false);

    const defaultEndpoint = config?.flightctl?.defaultEndpoint ?? "";

    useEffect(() => {
        if (userEditedRef.current) {
            return;
        }

        const enrollment = model.enrollment;
        if (enrollment.selected) {
            let endpoint = enrollment.endpoint;
            if (!endpoint && !enrollment.useExisting) {
                endpoint = defaultEndpoint;
            }
            if (endpoint) {
                try {
                    const url = new URL(endpoint);
                    updateModel("connectivityTestHost", url.hostname);
                } catch {
                    updateModel("connectivityTestHost", endpoint);
                }
                return;
            }
        }

        const configHost = config?.connectivityTest?.host || "www.google.com";
        updateModel("connectivityTestHost", configHost);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [model.enrollment, defaultEndpoint]);

    const setHost = (value: string) => {
        userEditedRef.current = true;
        updateModel("connectivityTestHost", value);
    };

    return (
        <FormGroup label={_("Connectivity test host")} isRequired>
            <TextInput
                id="connectivity-test-host-input"
                value={model.connectivityTestHost}
                onChange={(_event, value) => setHost(value)}
                isRequired
            />
            <FormHelperText
                content={_(
                    "The wizard will test network connectivity to this host before applying configuration changes."
                )}
            />
        </FormGroup>
    );
};
