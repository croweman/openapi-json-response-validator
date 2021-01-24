const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const axios = require('axios');
const { 
    validationServiceInitialise, 
    validationServiceInitialisationErrored, 
    validationServiceDispose, 
    validateRequest 
} = require('./express-json-response-validation')

let server
let validationPort;
let port = process.env.OPENAPI_JSON_RESPONSE_VALIDATOR_PORT
let initialisationOptions
let validationInitialised = false
let initialisationError = false
let exitProcessWhenServiceIsStopped = true

/*
    apiSpec - name/path (required)
    port - (optional) default random port or OPENAPI_JSON_RESPONSE_VALIDATOR_PORT environment variable if defined
                 returns port the server is exposed on
*/
const initialise = async (options) => {
    const initialisationOptions = options || {}
    
    try {
        validationPort = await validationServiceInitialise(initialisationOptions)    
    } catch (err) {
        initialisationError = true
        throw new Error('Validation server could not be started: ' + err.toString())
    }

    port = await startServer(options)
    let response
    
    try {
        response = await axios.get(`http://localhost:${port}/readiness`)
        
        if (initialisationError)
            throw new Error('An error occurred while trying to initialise. apiSpec failed to be loaded')
    } catch (err) {
        initialisationError = true
        throw new Error('An error occurred while trying to initialise. Express server did not start successfully')
    }

    if (response.status !== 200)
        throw new Error('An error occurred while trying to initialise. Express server did not start successfully')
    
    validationInitialised = true

    return port 
}

const dispose = () => stopServers()

const startServer = async (options) => {
    initialisationOptions = options || {}

    port = process.env.OPENAPI_JSON_RESPONSE_VALIDATOR_PORT

    if (initialisationOptions.port)
        port = initialisationOptions.port
    
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

const validateResponse = async (method, path, statusCode, headers, json) => {
    if (!validationInitialised)
        throw new Error('You must initialise')
    
    if (!validateRequest({
        method,
        path,
        headers,
        statusCode
    })) {
        throw new Error('You must provide the correct arguments')
    }

    let response;
    
    try {
        response = await axios.post(`http://localhost:${port}/validate-response`, {
            method,
            path,
            headers,
            statusCode,
            json
        })
        
        if (response.status === 200) {
            return response.data
        }

        return {
            success: false,
            errors: [ 'something unexpected has happened']
        }
            
    } catch (err) {
        console.log(err)

        return {
            success: false,
            errors: [ err]
        }
    }
}

const exposeHttpServer = async () => {

    app.use(bodyParser.json())
    app.use(bodyParser.text());
    app.use(bodyParser.urlencoded({ extended: false }));
    
    app.get('/readiness', (req, res) => {
        res.status(200).end()
    })
    
    app.post('/validate-response', async (req, res) => {
        const { body } = req

        if (!validateRequest(body))
            return res.status(400).send('Request body is invalid')

        const { statusCode } = body
        
        let response;

        try {
            response = await axios.post(`http://localhost:${validationPort}/validate-response`, body)
        } catch (err) {
            let error = err

            if (err && err.response && err.response.data)
                error = err.response.data

            let success = false
            let errors = []

            if (err && err.response && err.response.status)
                success = err.response.status === statusCode

            if (!success)
                errors.push(error)

            return res.status(200).send({
                success: success,
                errors: errors
            })
        }

        if (response.data && response.data.success !== undefined && response.data['express_json_response_validation'] === true) {
            delete response.data['express_json_response_validation']
            return res.status(200).send(response.data)
        }

        return res.status(200).send({
            success: response.status === statusCode,
            errors: []
        })
    })

    app.use((err, req, res, next) => {
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
            });
        });
    });
    

    server = await app.listen(port)
    port = server.address().port
    console.log(`openapi-json-response-validator-external listening at http://localhost:${port}`)
    
    process.on('SIGTERM', stopServers);
    process.on('SIGINT', stopServers);
}

const stopServers = () => {
    validationInitialised = false
    initialisationError = false
    
    validationServiceDispose()
    
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

module.exports = {
    initialise,
    initialised: () => validationInitialised,
    initialisationErrored: () => initialisationError || validationServiceInitialisationErrored(),
    validateResponse,
    dispose
}
