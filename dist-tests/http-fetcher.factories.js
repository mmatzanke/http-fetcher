import { fake } from 'sinon';
export const createErrorReporterMock = (overrides) => ({
    ...overrides,
    reportError: fake(),
});
