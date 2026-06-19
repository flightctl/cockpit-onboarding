import React, { useRef, useEffect } from "react";
import cockpit from "cockpit";

import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";

import { useModelContext } from "../model-context";
import { useConfig } from "../app";
import DefaultHelperText from "../components/HelperTexts";
import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput";

const _ = cockpit.gettext;

export const ConnectivityTestPage = () => {
    const { model, updateModel } = useModelContext();
    const { config } = useConfig();
    const userEditedRef = useRef(false);

    useEffect(() => {
        if (userEditedRef.current) {
            return;
        }

        const selectedServices = model.enrollment.selectedServices || [];
        const enrollmentServices = config?.enrollmentServices || [];
        const useExisting = model.enrollment.useExisting || {};

        if (selectedServices.length > 0) {
            const firstSelected = enrollmentServices.find((s) => selectedServices.includes(s.id));
            if (firstSelected) {
                const isUsingExisting = useExisting[firstSelected.id] ?? false;
                const endpoint =
                    model.enrollment.endpoints[firstSelected.id] ||
                    (!isUsingExisting ? firstSelected.endpoint.url : "");
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
        }

        const configHost = config?.connectivityTest?.host || "www.google.com";
        updateModel("connectivityTestHost", configHost);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [model.enrollment.selectedServices, model.enrollment.endpoints, model.enrollment.useExisting]);

    const setHost = (value: string) => {
        userEditedRef.current = true;
        updateModel("connectivityTestHost", value);
    };

    return (
        <FormGroup label={_("Connectivity test host")} isRequired>
            <TextInput
                id="connectivity-test-host-input"
                value={model.connectivityTestHost}
                onChange={(_ev, value) => setHost(value)}
                placeholder="www.google.com"
            />
            <DefaultHelperText
                text={_("DNS resolution and ping will be tested against this host during the apply step.")}
            />
        </FormGroup>
    );
};
