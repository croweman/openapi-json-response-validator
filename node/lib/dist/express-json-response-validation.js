const express = require('express')
const bodyParser = require('body-parser')
const axios = require('axios');
const fs = require('fs')
const path = require('path')
const OpenApiValidator = require('express-openapi-validator');

let app
let port
let server
let initialisationOptions
let validationInitialised = false
let initialisationError = false
let exitProcessWhenServiceIsStopped = true
let readinessPath
let readinessRoutePath

/*
    apiSpec - name/path (required)
*/
const validationServiceInitialise = async (options) => {
    port = await startServer(options)
    
    let attempts = 0;
    let response
    let lastError

    while (attempts < 20) {
        attempts++;
        
        if (initialisationError === true)
            break

        try {
            response = await checkReadiness()

            if (response !== undefined && response.status === 202) {
                validationInitialised = true
                break
            }
            
        } catch (err) {
            lastError = err
        }
        
        await sleep()
    }
    
    if (!validationInitialised) {
        if (lastError)
            throw lastError

        throw new Error('An error occurred while trying to initialise. Express server did not start successfully')
    }
    
    return port
}

const sleep = () => {
    return new Promise(resolve => {
        setTimeout(() => resolve(), 500)
    })
}

const checkReadiness = async () => {
    let response
    
    try {
        response = await axios.get(`http://localhost:${port}${readinessPath}`)

        if (initialisationError)
            throw new Error('An error occurred while trying to initialise. apiSpec failed to be loaded')
    } catch (err) {
        throw new Error('An error occurred while trying to initialise. Express server did not start successfully')
    }

    return response
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
    const apiSpec = addReadinessRouteToApiSpec()

    const validationMiddleware = await OpenApiValidator.middleware({
        apiSpec: apiSpec,
        validateRequests: false,
        validateResponses: true
    })

    app = express()
    app.use(bodyParser.json())
    app.use(bodyParser.text());
    app.use(bodyParser.urlencoded({ extended: false }));

    app.use((req, res, next) => {
        if (req.path !== '/validate-response' && req.path !== readinessPath)
            return res.status(404).end()

        if (req.path === '/validate-response' && req.method.toLowerCase() !== 'post')
            return res.status(404).end()

        if (req.path === readinessPath)
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
    
    app.get(readinessPath, (req, res) => {
        if (!req.openapi)
            return res.status(500).end()
        
        res.status(202).end()
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
        
        if (errors.length > 0 && errors[0].path === '/validate-response')
            errors[0].path = req.originalUrl

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
    port = undefined
    app = undefined

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

const addReadinessRouteToApiSpec = () => {
    const origCwd = process.cwd();
    const absoluteFilePath = path.resolve(origCwd, initialisationOptions.apiSpec)
    
    const newFilePath = absoluteFilePath.replace(/\./, '-') + '_with_readiness.yaml'

    fs.copyFileSync(absoluteFilePath, newFilePath)

    let fileContent = fs.readFileSync(newFilePath, 'utf8')

    let titleIndex = fileContent.indexOf('title:')
    let pathIndex = fileContent.indexOf('paths:')
    if (titleIndex === -1 || pathIndex === -1)
        throw new Error('OpenApi definition does not contain a title or paths')

    let padding = fileContent.substr(0, titleIndex)
    padding = padding.substr(padding.lastIndexOf('\n') + 1)
    
    let serversIndex = fileContent.indexOf('servers:')
    if (serversIndex === -1) {
        readinessPath = '/express-json-response-validation-readiness'
        readinessRoutePath = '/express-json-response-validation-readiness'
    } else {
        readinessPath = '/express-json-response-validation/express-json-response-validation-readiness'
        readinessRoutePath = '/express-json-response-validation-readiness'
        let start = fileContent.substr(0, serversIndex + 8)
        let end = fileContent.substr(serversIndex + 8)
        fileContent = start + '\n' + padding + '- url: /express-json-response-validation' + end
    }

    pathIndex = fileContent.indexOf('paths:')
    let readinessContent = '\n' + padding + readinessRoutePath + ':\n'
    readinessContent += padding + padding + 'get:\n'
    readinessContent += padding + padding + padding + 'responses:\n'
    readinessContent += padding + padding + padding + padding + "'202':\n"
    readinessContent += padding + padding + padding + padding + padding +  'description: readiness endpoint\n\n'

    let start = fileContent.substr(0, pathIndex + 6)
    let end = fileContent.substr(pathIndex + 6)

    fileContent = start + readinessContent + end

    fs.writeFileSync(newFilePath, fileContent)
    
    return newFilePath
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
