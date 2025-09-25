import { fake } from 'sinon';

import type { ErrorReporter } from './index.js';
import type { SinonSpiedInstance } from 'sinon';

export const createErrorReporterMock = (overrides?: Partial<ErrorReporter>): SinonSpiedInstance<ErrorReporter> => ({
    ...overrides,
    reportError: fake(),
});
