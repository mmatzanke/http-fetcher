import { fake } from 'sinon';
import type { SinonSpiedInstance } from 'sinon';

import type { ErrorReporter } from '.';

export const createErrorReporterMock = (
    overrides?: Partial<ErrorReporter>,
): SinonSpiedInstance<ErrorReporter> => {
    return {
        ...overrides,
        reportError: fake(),
    };
};
