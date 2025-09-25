import assert from 'node:assert/strict';
import { Factory } from 'fishery';
import { HTTPError } from 'ky';
import { fake } from 'sinon';
import { Result } from 'true-myth';
import { suite, test } from 'mocha';
import { HTTPErrorWithResponseBody } from './http-error-with-response-body.js';
import { createHttpFetcher } from './http-fetcher.js';
import { createErrorReporterMock } from './http-fetcher.factories.js';
const responseJsonFactory = Factory.define(() => ({ test: true }));
const responseTextFactory = Factory.define(() => 'someResponseText');
const fakeJson = fake.resolves(responseJsonFactory.build());
const internalKyHttpErrorFactory = Factory.define(() => new HTTPError({
    json: fakeJson,
}, {}, {}));
const contentTypeFactory = Factory.define(() => 'application/json utf8');
const headerFactory = Factory.define(() => ({
    'Content-Type': contentTypeFactory.build(),
}));
const initialHeaderFactory = headerFactory.params({
    theHeader: 'the-header',
});
const testUrlFactory = Factory.define(({ transientParams }) => new URL(transientParams.pathname ?? '', 'http://example.com'));
const internalKyErrorResultExpectationFactory = Factory.define(() => Result.err(new HTTPErrorWithResponseBody(internalKyHttpErrorFactory.build(), responseJsonFactory.build())));
const createKyMock = (options) => {
    const { contentType, error, jsonResponse, textResponse } = options ?? {};
    const kyMockResponse = {
        headers: {
            get: fake.returns(contentType ?? 'some/content-type'),
        },
        json: fake.resolves(jsonResponse ?? responseJsonFactory.build()),
        text: fake.resolves(textResponse ?? responseTextFactory.build()),
    };
    if (error !== undefined) {
        return fake.rejects(error);
    }
    return fake.resolves(kyMockResponse);
};
suite('Http fetcher', () => {
    test('get uses the correct parameters', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        await httpFetcher.get({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: {},
                json: undefined,
                method: 'GET',
            },
        ]);
    });
    test('get uses the set headers', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { requestHeaders: initialHeaderFactory.build() });
        httpFetcher.requestHeaders = headerFactory.build();
        await httpFetcher.get({
            requestOptions: {
                headers: headerFactory.build({
                    foo: 'bar',
                }),
            },
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: headerFactory.build({
                    foo: 'bar',
                    theHeader: 'the-header',
                }),
                json: undefined,
                method: 'GET',
            },
        ]);
    });
    test('get uses the correct parameters when baseUrl is set through options', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { baseUrl: testUrlFactory.build() });
        await httpFetcher.get({
            pathname: '/somePath',
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build({ pathname: '/somePath' }),
            {
                headers: {},
                json: undefined,
                method: 'GET',
            },
        ]);
    });
    test('get uses the correct parameters when baseUrl and pathname is set through options', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, {
            baseUrl: testUrlFactory.build({
                pathname: '/the-base-path',
            }),
        });
        await httpFetcher.get({
            pathname: `/some-other-path`,
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build({
                pathname: `/the-base-path/some-other-path`,
            }),
            {
                headers: {},
                json: undefined,
                method: 'GET',
            },
        ]);
    });
    test('get resolves with response with Result ok when content type is "application/json"', async () => {
        const kyMock = createKyMock({ contentType: 'application/json utf8' });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.get({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseJsonFactory.build()));
    });
    test('get resolves with response as Result ok with text when content type is unknown', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.get({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseTextFactory.build()));
    });
    test('get resolves with response as Result error when internal ky error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.get({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, internalKyErrorResultExpectationFactory.build());
        assert.equal(errorReporter.reportError.callCount, 1);
        assert.deepEqual(errorReporter.reportError.lastCall.args, [
            internalKyHttpErrorFactory.build().message,
            internalKyHttpErrorFactory.build(),
        ]);
    });
    test('get executes with http error handlers when internal ky http error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const handler1 = fake();
        const handler2 = fake();
        const handler3 = fake();
        httpFetcher.addHttpErrorHandler(handler1);
        httpFetcher.addHttpErrorHandler(handler2);
        httpFetcher.addHttpErrorHandler(handler3);
        await httpFetcher.get({
            url: testUrlFactory.build(),
        });
        assert.equal(handler1.callCount, 1);
        assert.deepEqual(handler1.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler2.callCount, 1);
        assert.deepEqual(handler2.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler3.callCount, 1);
        assert.deepEqual(handler3.lastCall.args, [internalKyHttpErrorFactory.build()]);
    });
    test('post uses the correct parameters', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        await httpFetcher.post({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: {},
                json: undefined,
                method: 'POST',
            },
        ]);
    });
    test('post uses the set headers', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { requestHeaders: initialHeaderFactory.build() });
        httpFetcher.requestHeaders = headerFactory.build();
        await httpFetcher.post({
            requestOptions: {
                headers: headerFactory.build({
                    foo: 'bar',
                }),
            },
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: headerFactory.build({
                    foo: 'bar',
                    theHeader: 'the-header',
                }),
                json: undefined,
                method: 'POST',
            },
        ]);
    });
    test('post resolves with response with Result ok when content type is "application/json"', async () => {
        const kyMock = createKyMock({ contentType: contentTypeFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.post({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseJsonFactory.build()));
    });
    test('post resolves with response as Result ok with text when content type is unknown', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.post({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseTextFactory.build()));
    });
    test('post resolves with response as Result error when internal ky error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.post({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, internalKyErrorResultExpectationFactory.build());
        assert.equal(errorReporter.reportError.callCount, 1);
        assert.deepEqual(errorReporter.reportError.lastCall.args, [
            internalKyHttpErrorFactory.build().message,
            internalKyHttpErrorFactory.build(),
        ]);
    });
    test('post executes with http error handlers when internal ky http error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const handler1 = fake();
        const handler2 = fake();
        const handler3 = fake();
        httpFetcher.addHttpErrorHandler(handler1);
        httpFetcher.addHttpErrorHandler(handler2);
        httpFetcher.addHttpErrorHandler(handler3);
        await httpFetcher.post({
            url: testUrlFactory.build(),
        });
        assert.equal(handler1.callCount, 1);
        assert.deepEqual(handler1.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler2.callCount, 1);
        assert.deepEqual(handler2.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler3.callCount, 1);
        assert.deepEqual(handler3.lastCall.args, [internalKyHttpErrorFactory.build()]);
    });
    test('postJson uses the correct parameters', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        await httpFetcher.postJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: {},
                json: responseJsonFactory.build(),
                method: 'POST',
            },
        ]);
    });
    test('postJson uses the set headers', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { requestHeaders: initialHeaderFactory.build() });
        httpFetcher.requestHeaders = headerFactory.build();
        await httpFetcher.postJson({
            payload: responseJsonFactory.build(),
            requestOptions: {
                headers: headerFactory.build({
                    foo: 'bar',
                }),
            },
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: headerFactory.build({
                    foo: 'bar',
                    theHeader: 'the-header',
                }),
                json: responseJsonFactory.build(),
                method: 'POST',
            },
        ]);
    });
    test('postJson uses the correct parameters when baseUrl is set through options', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { baseUrl: testUrlFactory.build() });
        await httpFetcher.postJson({
            pathname: '/somePath',
            payload: responseJsonFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build({ pathname: '/somePath' }),
            {
                headers: {},
                json: responseJsonFactory.build(),
                method: 'POST',
            },
        ]);
    });
    test('postJson resolves with response with Result ok when content type is "application/json"', async () => {
        const kyMock = createKyMock({ contentType: contentTypeFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.postJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseJsonFactory.build()));
    });
    test('postJson resolves with response as Result ok with text when content type is unknown', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.postJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseTextFactory.build()));
    });
    test('postJson resolves with response as Result error when internal ky error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.postJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, internalKyErrorResultExpectationFactory.build());
        assert.equal(errorReporter.reportError.callCount, 1);
        assert.deepEqual(errorReporter.reportError.lastCall.args, [
            internalKyHttpErrorFactory.build().message,
            internalKyHttpErrorFactory.build(),
        ]);
    });
    test('postJson executes with http error handlers when internal ky http error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const handler1 = fake();
        const handler2 = fake();
        const handler3 = fake();
        httpFetcher.addHttpErrorHandler(handler1);
        httpFetcher.addHttpErrorHandler(handler2);
        httpFetcher.addHttpErrorHandler(handler3);
        await httpFetcher.postJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.equal(handler1.callCount, 1);
        assert.deepEqual(handler1.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler2.callCount, 1);
        assert.deepEqual(handler2.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler3.callCount, 1);
        assert.deepEqual(handler3.lastCall.args, [internalKyHttpErrorFactory.build()]);
    });
    test('patchJson uses the correct parameters', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        await httpFetcher.patchJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: {},
                json: responseJsonFactory.build(),
                method: 'PATCH',
            },
        ]);
    });
    test('patchJson uses the set headers', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { requestHeaders: initialHeaderFactory.build() });
        httpFetcher.requestHeaders = headerFactory.build();
        await httpFetcher.patchJson({
            payload: responseJsonFactory.build(),
            requestOptions: {
                headers: headerFactory.build({
                    foo: 'bar',
                }),
            },
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: headerFactory.build({
                    foo: 'bar',
                    theHeader: 'the-header',
                }),
                json: responseJsonFactory.build(),
                method: 'PATCH',
            },
        ]);
    });
    test('patchJson uses the correct parameters when baseUrl is set through options', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { baseUrl: testUrlFactory.build() });
        await httpFetcher.patchJson({
            pathname: '/somePath',
            payload: responseJsonFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build({ pathname: '/somePath' }),
            {
                headers: {},
                json: responseJsonFactory.build(),
                method: 'PATCH',
            },
        ]);
    });
    test('patchJson resolves with response with Result ok when content type is "application/json"', async () => {
        const kyMock = createKyMock({ contentType: contentTypeFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.patchJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseJsonFactory.build()));
    });
    test('patchJson resolves with response as Result ok with text when content type is unknown', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.patchJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseTextFactory.build()));
    });
    test('patchJson resolves with response as Result error when internal ky error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.patchJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, internalKyErrorResultExpectationFactory.build());
        assert.equal(errorReporter.reportError.callCount, 1);
        assert.deepEqual(errorReporter.reportError.lastCall.args, [
            internalKyHttpErrorFactory.build().message,
            internalKyHttpErrorFactory.build(),
        ]);
    });
    test('patchJson executes with http error handlers when internal ky http error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const handler1 = fake();
        const handler2 = fake();
        const handler3 = fake();
        httpFetcher.addHttpErrorHandler(handler1);
        httpFetcher.addHttpErrorHandler(handler2);
        httpFetcher.addHttpErrorHandler(handler3);
        await httpFetcher.patchJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.equal(handler1.callCount, 1);
        assert.deepEqual(handler1.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler2.callCount, 1);
        assert.deepEqual(handler2.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler3.callCount, 1);
        assert.deepEqual(handler3.lastCall.args, [internalKyHttpErrorFactory.build()]);
    });
    test('put uses the correct parameters', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        await httpFetcher.put({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: {},
                json: undefined,
                method: 'PUT',
            },
        ]);
    });
    test('put uses the set headers', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { requestHeaders: initialHeaderFactory.build() });
        httpFetcher.requestHeaders = headerFactory.build();
        await httpFetcher.put({
            requestOptions: {
                headers: headerFactory.build({
                    foo: 'bar',
                }),
            },
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: headerFactory.build({
                    foo: 'bar',
                    theHeader: 'the-header',
                }),
                json: undefined,
                method: 'PUT',
            },
        ]);
    });
    test('put uses the correct parameters when baseUrl is set through options', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { baseUrl: testUrlFactory.build() });
        await httpFetcher.put({
            pathname: '/somePath',
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build({ pathname: '/somePath' }),
            {
                headers: {},
                json: undefined,
                method: 'PUT',
            },
        ]);
    });
    test('put resolves with response with Result ok when content type is "application/json"', async () => {
        const kyMock = createKyMock({ contentType: contentTypeFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.put({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseJsonFactory.build()));
    });
    test('put resolves with response as Result ok with text when content type is unknown', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.put({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseTextFactory.build()));
    });
    test('put resolves with response as Result error when internal ky error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.put({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, internalKyErrorResultExpectationFactory.build());
        assert.equal(errorReporter.reportError.callCount, 1);
        assert.deepEqual(errorReporter.reportError.lastCall.args, [
            internalKyHttpErrorFactory.build().message,
            internalKyHttpErrorFactory.build(),
        ]);
    });
    test('put executes with http error handlers when internal ky http error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const handler1 = fake();
        const handler2 = fake();
        const handler3 = fake();
        httpFetcher.addHttpErrorHandler(handler1);
        httpFetcher.addHttpErrorHandler(handler2);
        httpFetcher.addHttpErrorHandler(handler3);
        await httpFetcher.put({
            url: testUrlFactory.build(),
        });
        assert.equal(handler1.callCount, 1);
        assert.deepEqual(handler1.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler2.callCount, 1);
        assert.deepEqual(handler2.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler3.callCount, 1);
        assert.deepEqual(handler3.lastCall.args, [internalKyHttpErrorFactory.build()]);
    });
    test('putJson uses the correct parameters', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        await httpFetcher.putJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: {},
                json: responseJsonFactory.build(),
                method: 'PUT',
            },
        ]);
    });
    test('putJson uses the set headers', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { requestHeaders: initialHeaderFactory.build() });
        httpFetcher.requestHeaders = headerFactory.build();
        await httpFetcher.putJson({
            payload: responseJsonFactory.build(),
            requestOptions: {
                headers: headerFactory.build({
                    foo: 'bar',
                }),
            },
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: headerFactory.build({
                    foo: 'bar',
                    theHeader: 'the-header',
                }),
                json: responseJsonFactory.build(),
                method: 'PUT',
            },
        ]);
    });
    test('putJson uses the correct parameters when baseUrl is set through options', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { baseUrl: testUrlFactory.build() });
        await httpFetcher.putJson({
            pathname: '/somePath',
            payload: responseJsonFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build({ pathname: '/somePath' }),
            {
                headers: {},
                json: responseJsonFactory.build(),
                method: 'PUT',
            },
        ]);
    });
    test('putJson resolves with response with Result ok when content type is "application/json"', async () => {
        const kyMock = createKyMock({ contentType: contentTypeFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.putJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseJsonFactory.build()));
    });
    test('putJson resolves with response as Result ok with text when content type is unknown', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.putJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseTextFactory.build()));
    });
    test('putJson resolves with response as Result error when internal ky error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.putJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, internalKyErrorResultExpectationFactory.build());
        assert.equal(errorReporter.reportError.callCount, 1);
        assert.deepEqual(errorReporter.reportError.lastCall.args, [
            internalKyHttpErrorFactory.build().message,
            internalKyHttpErrorFactory.build(),
        ]);
    });
    test('putJson executes with http error handlers when internal ky http error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const handler1 = fake();
        const handler2 = fake();
        const handler3 = fake();
        httpFetcher.addHttpErrorHandler(handler1);
        httpFetcher.addHttpErrorHandler(handler2);
        httpFetcher.addHttpErrorHandler(handler3);
        await httpFetcher.putJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.equal(handler1.callCount, 1);
        assert.deepEqual(handler1.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler2.callCount, 1);
        assert.deepEqual(handler2.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler3.callCount, 1);
        assert.deepEqual(handler3.lastCall.args, [internalKyHttpErrorFactory.build()]);
    });
    test('deleteJson uses the correct parameters', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        await httpFetcher.deleteJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: {},
                json: responseJsonFactory.build(),
                method: 'DELETE',
            },
        ]);
    });
    test('deleteJson uses the set headers', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { requestHeaders: initialHeaderFactory.build() });
        httpFetcher.requestHeaders = headerFactory.build();
        await httpFetcher.deleteJson({
            payload: responseJsonFactory.build(),
            requestOptions: {
                headers: headerFactory.build({
                    foo: 'bar',
                }),
            },
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: headerFactory.build({
                    foo: 'bar',
                    theHeader: 'the-header',
                }),
                json: responseJsonFactory.build(),
                method: 'DELETE',
            },
        ]);
    });
    test('deleteJson uses the correct parameters when baseUrl is set through options', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { baseUrl: testUrlFactory.build() });
        await httpFetcher.deleteJson({
            pathname: '/somePath',
            payload: responseJsonFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build({ pathname: '/somePath' }),
            {
                headers: {},
                json: responseJsonFactory.build(),
                method: 'DELETE',
            },
        ]);
    });
    test('deleteJson resolves with response with Result ok when content type is "application/json"', async () => {
        const kyMock = createKyMock({ contentType: contentTypeFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.deleteJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseJsonFactory.build()));
    });
    test('deleteJson resolves with response as Result ok with text when content type is unknown', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.deleteJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseTextFactory.build()));
    });
    test('deleteJson resolves with response as Result error when internal ky error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.deleteJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, internalKyErrorResultExpectationFactory.build());
        assert.equal(errorReporter.reportError.callCount, 1);
        assert.deepEqual(errorReporter.reportError.lastCall.args, [
            internalKyHttpErrorFactory.build().message,
            internalKyHttpErrorFactory.build(),
        ]);
    });
    test('deleteJson executes with http error handlers when internal ky http error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const handler1 = fake();
        const handler2 = fake();
        const handler3 = fake();
        httpFetcher.addHttpErrorHandler(handler1);
        httpFetcher.addHttpErrorHandler(handler2);
        httpFetcher.addHttpErrorHandler(handler3);
        await httpFetcher.deleteJson({
            payload: responseJsonFactory.build(),
            url: testUrlFactory.build(),
        });
        assert.equal(handler1.callCount, 1);
        assert.deepEqual(handler1.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler2.callCount, 1);
        assert.deepEqual(handler2.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler3.callCount, 1);
        assert.deepEqual(handler3.lastCall.args, [internalKyHttpErrorFactory.build()]);
    });
    test('delete uses the correct parameters', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        await httpFetcher.delete({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: {},
                json: undefined,
                method: 'DELETE',
            },
        ]);
    });
    test('delete uses the set headers', async () => {
        const kyMock = createKyMock();
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock }, { requestHeaders: initialHeaderFactory.build() });
        httpFetcher.requestHeaders = headerFactory.build();
        await httpFetcher.delete({
            requestOptions: {
                headers: headerFactory.build({
                    foo: 'bar',
                }),
            },
            url: testUrlFactory.build(),
        });
        assert.deepEqual(kyMock.firstCall.args, [
            testUrlFactory.build(),
            {
                headers: headerFactory.build({
                    foo: 'bar',
                    theHeader: 'the-header',
                }),
                json: undefined,
                method: 'DELETE',
            },
        ]);
    });
    test('delete resolves with response with Result ok when content type is "application/json"', async () => {
        const kyMock = createKyMock({ contentType: contentTypeFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.delete({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseJsonFactory.build()));
    });
    test('delete resolves with response as Result ok with text when content type is unknown', async () => {
        const kyMock = createKyMock({ jsonResponse: responseJsonFactory.build() });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.delete({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, Result.ok(responseTextFactory.build()));
    });
    test('delete resolves with error as Result error when internal ky error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const result = await httpFetcher.delete({
            url: testUrlFactory.build(),
        });
        assert.deepEqual(result, internalKyErrorResultExpectationFactory.build());
        assert.equal(errorReporter.reportError.callCount, 1);
        assert.deepEqual(errorReporter.reportError.lastCall.args, [
            internalKyHttpErrorFactory.build().message,
            internalKyHttpErrorFactory.build(),
        ]);
    });
    test('delete executes with http error handlers when internal ky http error', async () => {
        const kyMock = createKyMock({
            contentType: contentTypeFactory.build(),
            error: internalKyHttpErrorFactory.build(),
        });
        const errorReporter = createErrorReporterMock();
        const httpFetcher = createHttpFetcher({ errorReporter, ky: kyMock });
        const handler1 = fake();
        const handler2 = fake();
        const handler3 = fake();
        httpFetcher.addHttpErrorHandler(handler1);
        httpFetcher.addHttpErrorHandler(handler2);
        httpFetcher.addHttpErrorHandler(handler3);
        await httpFetcher.delete({
            url: testUrlFactory.build(),
        });
        assert.equal(handler1.callCount, 1);
        assert.deepEqual(handler1.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler2.callCount, 1);
        assert.deepEqual(handler2.lastCall.args, [internalKyHttpErrorFactory.build()]);
        assert.equal(handler3.callCount, 1);
        assert.deepEqual(handler3.lastCall.args, [internalKyHttpErrorFactory.build()]);
    });
});
