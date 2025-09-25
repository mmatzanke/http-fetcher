import { HTTPError } from 'ky';
export class HTTPErrorWithResponseBody extends HTTPError {
    error;
    body;
    constructor(error, body) {
        super(error.response, error.request, error.options);
        this.error = error;
        this.body = body;
    }
}
