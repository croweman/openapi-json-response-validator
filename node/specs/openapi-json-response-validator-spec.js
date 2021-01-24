const { initialise, initialised, initialisationErrored, validateResponse, dispose } = require('../lib')
const axios = require('axios');
const { expect } = require('chai')

describe('openapi-json-response-validator', () => {
    before(() => {
        process.env.TESTING = true
        delete process.env.OPENAPI_JSON_RESPONSE_VALIDATOR_PORT
    })
    
    afterEach(() => {
        dispose()
    })
    
    describe('initialisation', () => {
        it('initialises when a valid apiSpec is supplied', async () => {
            const port = await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })
            expect(port).to.satisfy(Number.isInteger)
            expect(initialised()).to.equal(true)
            expect(initialisationErrored()).to.equal(false)
        })

        it('fails to initialise when apiSpec is invalid', async () => {
            try {
                await initialise({ apiSpec: './specs/invalid-api.yaml', exitProcessWhenServiceIsStopped: false })
                throw new Error('Fail')
            } catch (err) {
                expect(err.message).to.equal('Validation server could not be started: Error: An error occurred while trying to initialise. Express server did not start successfully')
                expect(initialised()).to.equal(false)
                expect(initialisationErrored()).to.equal(true)
            }
        })

        it('fails to initialise when apiSpec does not exist', async () => {
            try {
                await initialise({ apiSpec: 'cheese.yaml', exitProcessWhenServiceIsStopped: false })
                throw new Error('Fail')
            } catch (err) {
                expect(err.message).to.equal('Validation server could not be started: Error: An error occurred while trying to expose the server')
                expect(initialised()).to.equal(false)
                expect(initialisationErrored()).to.equal(true)
            }
        })
    })

    describe('validateResponse', () => {
        describe('returns success', () => {
            it('when the response is a valid empty array', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })
                
                let result = await validateResponse('GET', '/v1/pets', 200, {}, [])

                expect(result.success).to.equal(true)
                expect(result.errors.length).to.equal(0)
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when the response is a valid populated array', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })
                
                let result = await validateResponse('GET', '/v1/pets',200, {}, [
                    {
                        id: 123,
                        name: 'joe',
                        type: 'dog'
                    }
                ])

                expect(result.success).to.equal(true)
                expect(result.errors.length).to.equal(0)
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when 400 error is returned that conforms to schema', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets', 400, {},  [
                    "Give me valid input"
                ])
                
                expect(result.success).to.equal(true)
                expect(result.errors.length).to.equal(0)
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })
        })
        
        describe('returns failure', () => {
            it('when not initialised', async () => {
                try {
                    await validateResponse('GET', '/v1/pets', 200, {}, {})
                    throw new Error('Fail')
                } catch (err) {
                    expect(err.message).to.equal('You must initialise')
                    expect(initialised()).to.equal(false)
                    expect(initialisationErrored()).to.equal(false)
                }
            })
            
            it('when the response is not of the expected type', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets', 200, {}, {})

                expect(result.success).to.equal(false)
                expect(result.errors.length).to.equal(1)
                expect(result.errors[0].path).to.equal('.response')
                expect(result.errors[0].message).to.equal('should be array')
                expect(result.errors[0].errorCode).to.equal('type.openapi.validation')
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when the response contains an object with additional properties', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets', 200, {}, [
                    {
                        id: 123,
                        name: 'joe',
                        type: 'dog',
                        newProperty: 'because'
                    }
                ])
                
                expect(result.success).to.equal(false)
                expect(result.errors.length).to.equal(1)
                expect(result.errors[0].path).to.equal('.response[0].newProperty')
                expect(result.errors[0].message).to.equal('should NOT have additional properties')
                expect(result.errors[0].errorCode).to.equal('additionalProperties.openapi.validation')
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when the response contains an object with a property defined with the wrong type', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets', 200, {}, [
                    {
                        id: 123,
                        name: 111,
                        type: 'dog',
                    }
                ])

                expect(result.success).to.equal(false)
                expect(result.errors.length).to.equal(1)
                expect(result.errors[0].path).to.equal('.response[0].name')
                expect(result.errors[0].message).to.equal('should be string')
                expect(result.errors[0].errorCode).to.equal('type.openapi.validation')
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when invalid request parameters are provided', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                try {
                    await validateResponse('GET', 1, 200, {}, [
                        {
                            id: 123,
                            name: 111,
                            type: 'dog',
                        }
                    ])
                    throw new Error('Fail')
                } catch (err) {
                    expect(err.toString()).to.equal('Error: You must provide the correct arguments')
                }

                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when 400 error is returned that does not conform to schema', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets', 400, {}, [
                    1234
                ])
                
                expect(result.success).to.equal(false)
                expect(result.errors.length).to.equal(1)
                expect(result.errors[0].path).to.equal('.response[0]')
                expect(result.errors[0].message).to.equal('should be string')
                expect(result.errors[0].errorCode).to.equal('type.openapi.validation')
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when the route does not exist', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets2', 200, {}, {})

                console.log(result)
                expect(result.success).to.equal(false)
                expect(result.errors.length).to.equal(1)
                expect(result.errors[0].path).to.equal('/v1/pets2')
                expect(result.errors[0].message).to.equal('not found')
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when the route exists but the method type is not supported', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('POST', '/v1/pets', 200, {}, {})

                console.log(result)
                expect(result.success).to.equal(false)
                expect(result.errors.length).to.equal(1)
                expect(result.errors[0].path).to.equal('/v1/pets')
                expect(result.errors[0].message).to.equal('POST method not allowed')
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })
        })
    })

    describe('express server', () => {
        it('is exposed on random port when no environment variable or options port defined', async () => {
            const port = await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

            const response = await axios.get(`http://localhost:${port}/readiness`)
            
            expect(response.status).to.equal(200)
        })

        it('is exposed on specific port when environment variable is defined', async () => {
            process.env.OPENAPI_JSON_RESPONSE_VALIDATOR_PORT = 3001

            const port = await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

            const response = await axios.get(`http://localhost:${port}/readiness`)
            
            expect(response.status).to.equal(200)
            expect(port).to.equal(3001)
        })

        it('is exposed on specific port when options.port is defined', async () => {
            const port = await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false, port: 3002 })

            const response = await axios.get(`http://localhost:${port}/readiness`)

            expect(response.status).to.equal(200)
            expect(port).to.equal(3002)
        })

        it('is exposed on specific port when environment variable and options.port is defined', async () => {
            process.env.OPENAPI_JSON_RESPONSE_VALIDATOR_PORT = 3001

            const port = await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false, port: 3002 })

            const response = await axios.get(`http://localhost:${port}/readiness`)

            expect(response.status).to.equal(200)
            expect(port).to.equal(3002)
        })
        
        it('validate-response endpoint should validate valid response correctly', async () => {
            const port = await initialise({ apiSpec: './specs/api.yaml' })
            
            const response = await axios.post(`http://localhost:${port}/validate-response`, {
                method: 'GET',
                path: '/v1/pets',
                statusCode: 200,
                headers: { 'Cache-Control': 'no-cache' },
                json: [
                    {
                        id: 1,
                        name: 'joe',
                        type: 'dog'
                    }
                ]
            })

            expect(response.status).to.equal(200)
            expect(response.data.success).to.equal(true)
            expect(response.data.errors.length).to.equal(0)
        })

        it('validate-response endpoint should validate invalid response correctly', async () => {
            const port = await initialise({ apiSpec: './specs/api.yaml' })

            const response = await axios.post(`http://localhost:${port}/validate-response`, {
                method: 'GET',
                path: '/v1/pets',
                statusCode: 200,
                headers: { 'Cache-Control': 'no-cache' },
                json: [
                    {
                        id: '1234',
                        name: 'joe',
                        type: 'dog'
                    }
                ]
            })

            expect(response.status).to.equal(200)
            expect(response.data.success).to.equal(false)
            expect(response.data.errors.length).to.equal(1)
            expect(response.data.errors[0].path).to.equal('.response[0].id')
            expect(response.data.errors[0].message).to.equal('should be number')
            expect(response.data.errors[0].errorCode).to.equal('type.openapi.validation')
        })
    })
})