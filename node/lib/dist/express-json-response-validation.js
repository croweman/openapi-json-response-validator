const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const axios = require('axios');
const OpenApiValidator = require('express-openapi-validator');

let port
let server
let initialisationOptions
let validationInitialised = false
let initialisationError = false
let exitProcessWhenServiceIsStopped = true

/*
    apiSpec - name/path (required)
*/
const validationServiceInitialise = async (options) => {
    port = await startServer(options)

    let response;

    try {
        response = await axios.get(`http://localhost:${port}/readiness`)

        if (initialisationError)
            throw new Error('An error occurred while trying to initialise. apiSpec failed to be loaded')
    } catch (err) {
        initialisationError = true
        throw new Error('An error occurred while trying to initialise. Express server did not start successfully')
    }

    if (response.status !== 200) {
        throw new Error('An error occurred while trying to initialise. Express server did not start successfully')
    }

    validationInitialised = true

    return port
}

const validationServiceDispose = () => stopServer()

const isValidString = val => val !== undefined &&
    typeof(val) === 'string' &&
    val.length > 0

const validateRequest = body => body &&
    isValidString(body.method) &&
    isValidString(body.path) &&
    (body.headers !== undefined || typeof(body.headers) === 'object') &&
    (body.statusCode !== undefined || typeof(body.statusCode) === 'number')

const startServer = async (options) => {
    initialisationOptions = options || {}

    if (!initialisationOptions.apiSpec)
        throw new Error('You must have an apiSpec defined in the options')

    if (initialisationOptions.exitProcessWhenServiceIsStopped !== undefined)
        exitProcessWhenServiceIsStopped = initialisationOptions.exitProcessWhenServiceIsStopped

    try {
        await exposeHttpServer()
        return port
    } catch (err) {
        console.log(err)
        throw new Error('An error occurred while trying to expose the server')
    }
}

const getPath = path => {
    if (!path.startsWith('/'))
        return '/' + path

    return path
}

const exposeHttpServer = async () => {

    const validationMiddleware = await OpenApiValidator.middleware({
        apiSpec: initialisationOptions.apiSpec,
        validateRequests: false,
        validateResponses: true
    })

    app.use(bodyParser.json())
    app.use(bodyParser.text());
    app.use(bodyParser.urlencoded({ extended: false }));

    app.use((req, res, next) => {
        if (req.path !== '/validate-response' && req.path !== '/readiness')
            return res.status(404).end()

        if (req.path === '/validate-response' && req.method.toLowerCase() !== 'post')
            return res.status(404).end()

        if (req.path === '/readiness')
            return next();

        const { body } = req

        if (!validateRequest(body))
            return next('Request validation failed', req, res)

        req.method = body.method

        let requestPath = getPath(body.path)
        req.path = requestPath
        req.baseUrl = requestPath
        req.originalUrl = requestPath
        req.responseOverrides = {
            headers: body.headers,
            json: body.json,
            statusCode: body.statusCode
        }

        next()
    })

    app.use(validationMiddleware)

    app.get('/readiness', (req, res) => {
        res.status(200).end()
    })

    app.use((req, res, next) => {
        if (!req.openapi)
            return res.status(500).end()

        const { headers, json, statusCode } = req.responseOverrides

        Object.keys(headers).forEach(key => {
            res.set(key, headers[key])
        })
        
        res.status(statusCode).json(json)
    })


    app.use((err, req, res, next) => {
        let errors = []

        if (err) {
            if (err.errors)
                errors = err.errors
            else
                errors.push({ message: err.toString() })
        }

        res.status(200).json({
            success: false,
            errors: errors,
            'express_json_response_validation': true
        });
    });

    server = await app.listen(port)
    port = server.address().port
    console.log(`openapi-json-response-validator-internal listening at http://localhost:${port}`)
}

const stopServer = () => {
    initialisationOptions = undefined
    validationInitialised = false
    initialisationError = false

    if (!server) return

    server.close(() => {
        if (exitProcessWhenServiceIsStopped === true)
            process.exit(0)
    })

    if (!exitProcessWhenServiceIsStopped) return

    setTimeout(() => {
        process.exit(1);
    }, 10000).unref()
}

process.on('unhandledRejection', (reason, p) => {
    console.log('An error occurred while passing the openapi spec.', 'reason:', reason);

    if (reason && typeof(reason) === 'object' && reason.toString().indexOf('openapi') !== -1) {
        initialisationError = true
    }
});

module.exports = {
    validationServiceInitialise,
    validationServiceInitialised: () => validationInitialised,
    validationServiceInitialisationErrored: () => initialisationError,
    validationServiceDispose,
    validateRequest
}
