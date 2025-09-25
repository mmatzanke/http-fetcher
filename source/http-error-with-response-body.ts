import { HTTPError } from 'ky';

export class HTTPErrorWithResponseBody extends HTTPError {
    constructor(
        public readonly error: HTTPError,
        public readonly body: unknown,
    ) {
        super(error.response, error.request, error.options);
    }
}
