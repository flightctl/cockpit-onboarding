import React, { useRef, useEffect } from 'react';
import cockpit from 'cockpit';

import { TextInputGroup, TextInputGroupMain } from "@patternfly/react-core/dist/esm/components/TextInputGroup/index.js";
import { FormGroup, FormHelperText } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { HelperText, HelperTextItem } from "@patternfly/react-core/dist/esm/components/HelperText/index.js";
import { Stack, StackItem } from "@patternfly/react-core/dist/esm/layouts/Stack/index.js";
import { useModelContext } from '../model-context';
import { useConfig } from '../app';

const _ = cockpit.gettext;

export const ConnectivityTestPage: React.FunctionComponent = () => {
    const { model, updateModel } = useModelContext();
    const { config } = useConfig();
    const userEditedRef = useRef(false);

    useEffect(() => {
        if (userEditedRef.current) return;

        const selectedServices = model.enrollment.selectedServices || [];
        const enrollmentServices = config?.enrollmentServices || [];
        const useExisting = model.enrollment.useExisting || {};

        if (selectedServices.length > 0) {
            const firstSelected = enrollmentServices.find(s => selectedServices.includes(s.id));
            if (firstSelected) {
                const isUsingExisting = useExisting[firstSelected.id] ?? false;
                const endpoint = model.enrollment.endpoints[firstSelected.id] ||
                    (!isUsingExisting ? firstSelected.endpoint.url : '');
                if (endpoint) {
                    try {
                        const url = new URL(endpoint);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        updateModel('connectivityTestHost', url.hostname as any);
                    } catch {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        updateModel('connectivityTestHost', endpoint as any);
                    }
                    return;
                }
            }
        }

        const configHost = config?.connectivityTest?.host || 'www.google.com';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateModel('connectivityTestHost', configHost as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [model.enrollment.selectedServices, model.enrollment.endpoints, model.enrollment.useExisting]);

    const setHost = (value: string) => {
        userEditedRef.current = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateModel('connectivityTestHost', value as any);
    };

    return (
        <Stack hasGutter>
            <StackItem>
                <p>{_("Configure the host used to verify network connectivity after applying configuration changes.")}</p>
            </StackItem>
            <StackItem>
                <FormGroup label={_("Connectivity test host")} isRequired>
                    <TextInputGroup>
                        <TextInputGroupMain
                            id="connectivity-test-host-input"
                            value={model.connectivityTestHost}
                            onChange={(_, value) => setHost(value)}
                            placeholder="www.google.com"
                        />
                    </TextInputGroup>
                    <FormHelperText>
                        <HelperText>
                            <HelperTextItem>
                                {_("DNS resolution and ping will be tested against this host during the apply step.")}
                            </HelperTextItem>
                        </HelperText>
                    </FormHelperText>
                </FormGroup>
            </StackItem>
        </Stack>
    );
};
