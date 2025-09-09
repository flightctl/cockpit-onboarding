import React, { useState } from 'react';

import { TextInput } from "@patternfly/react-core/dist/esm/components/TextInput/index.js";
import { FormGroup } from "@patternfly/react-core/dist/esm/components/Form/index.js";
import { Checkbox } from "@patternfly/react-core/dist/esm/components/Checkbox/index.js";
import { Radio } from "@patternfly/react-core/dist/esm/components/Radio/index.js";
import { Stack, StackItem } from '@patternfly/react-core';
import { Flex, FlexItem } from '@patternfly/react-core';

export const EnrollmentPage: React.FunctionComponent = () => {
    const [enrollmentUrl, setEnrollmentUrl] = useState<string>('');
    const [skipTlsVerification, setSkipTlsVerification] = useState<boolean>(false);
    const [authMethod, setAuthMethod] = useState<'username-password' | 'token'>('username-password');
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [token, setToken] = useState<string>('');

    const isValidUrl = (url: string): boolean => {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const isHttpsUrl = (url: string): boolean => {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const urlValidated = enrollmentUrl ? (isValidUrl(enrollmentUrl) ? 'success' : 'error') : 'default';

    return (
        <Stack hasGutter>
            <StackItem>
                <p>Configure enrollment service connection:</p>
            </StackItem>
            <StackItem>
                <FormGroup 
                    label="Enrollment Service URL" 
                    isRequired
                    helperText={!enrollmentUrl ? "Enter a valid HTTP or HTTPS URL" : undefined}
                    helperTextInvalid="Please enter a valid HTTP or HTTPS URL"
                    validated={urlValidated}
                >
                    <TextInput
                        id="enrollment-url"
                        value={enrollmentUrl}
                        onChange={(_, value) => setEnrollmentUrl(value)}
                        placeholder="https://enrollment.example.com"
                        validated={urlValidated}
                    />
                </FormGroup>
            </StackItem>
            {isValidUrl(enrollmentUrl) && isHttpsUrl(enrollmentUrl) && (
                <StackItem>
                    <Checkbox
                        id="skip-tls-verification"
                        label="Skip TLS verification (insecure)"
                        isChecked={skipTlsVerification}
                        onChange={(_, checked) => setSkipTlsVerification(checked)}
                    />
                </StackItem>
            )}
            <StackItem>
                <FormGroup label="Authentication Method">
                    <Flex>
                        <FlexItem>
                            <Radio
                                id="auth-username-password"
                                name="auth-method"
                                label="Username and password"
                                isChecked={authMethod === 'username-password'}
                                onChange={() => setAuthMethod('username-password')}
                            />
                        </FlexItem>
                        <FlexItem>
                            <Radio
                                id="auth-token"
                                name="auth-method"
                                label="Token"
                                isChecked={authMethod === 'token'}
                                onChange={() => setAuthMethod('token')}
                            />
                        </FlexItem>
                    </Flex>
                </FormGroup>
            </StackItem>
            {authMethod === 'username-password' ? (
                <StackItem>
                    <Stack hasGutter>
                        <StackItem>
                            <FormGroup label="Username" isRequired>
                                <TextInput
                                    id="username"
                                    value={username}
                                    onChange={(_, value) => setUsername(value)}
                                    placeholder="Enter username"
                                />
                            </FormGroup>
                        </StackItem>
                        <StackItem>
                            <FormGroup label="Password" isRequired>
                                <TextInput
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(_, value) => setPassword(value)}
                                    placeholder="Enter password"
                                />
                            </FormGroup>
                        </StackItem>
                    </Stack>
                </StackItem>
            ) : (
                <StackItem>
                    <FormGroup label="Token" isRequired>
                        <TextInput
                            id="token"
                            value={token}
                            onChange={(_, value) => setToken(value)}
                            placeholder="Enter authentication token"
                        />
                    </FormGroup>
                </StackItem>
            )}
        </Stack>
    );
};