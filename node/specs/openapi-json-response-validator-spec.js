const { initialise, initialised, initialisationErrored, validateResponse, dispose } = require('../lib')
const { expect } = require('chai')

describe('openapi-json-response-validator', () => {
    before(() => {
        process.env.TESTING = true
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
                expect(err.message).to.equal('An error occurred while trying to initialise. Express server did not start successfully')
                expect(initialised()).to.equal(false)
                expect(initialisationErrored()).to.equal(true)
            }
        })

        it('fails to initialise when apiSpec does not exist', async () => {
            try {
                await initialise({ apiSpec: 'cheese.yaml', exitProcessWhenServiceIsStopped: false })
                throw new Error('Fail')
            } catch (err) {
                expect(err.message).to.equal('An error occurred while trying to initialise. Express server did not start successfully')
                expect(initialised()).to.equal(false)
                expect(initialisationErrored()).to.equal(true)
            }
        })
    })

    describe('validateResponse', () => {
        describe('returns success', () => {
            it('when the response is a valid empty array', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })
                
                let result = await validateResponse('GET', '/v1/pets', {}, 200, [])

                expect(result.success).to.equal(true)
                expect(result.errors.length).to.equal(0)
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when the response is a valid populated array', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets', {}, 200, [
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

            it('when invalid request parameters are provided', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', 1, {}, 200, [
                    {
                        id: 123,
                        name: 111,
                        type: 'dog',
                    }
                ])
                
                expect(result.success).to.equal(false)
                expect(result.errors.length).to.equal(1)
                expect(result.errors[0].message).to.equal('Request validation failed')
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when 400 error is returned that conforms to schema', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets', {}, 400, [
                    "Give me valid input"
                ])
                
                expect(result.success).to.equal(false)
                expect(result.errors.length).to.equal(1)
                expect(result.errors[0][0]).to.equal('Give me valid input')
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })
        })
        
        describe('returns failure', () => {
            it('when not initialised', async () => {
                try {
                    await validateResponse('GET', '/v1/pets', {}, 200, {})
                    throw new Error('Fail')
                } catch (err) {
                    expect(err.message).to.equal('You must initialise')
                    expect(initialised()).to.equal(false)
                    expect(initialisationErrored()).to.equal(false)
                }
            })
            
            it('when the response is not of the expected type', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets', {}, 200, {})

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

                let result = await validateResponse('GET', '/v1/pets', {}, 200, [
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

                let result = await validateResponse('GET', '/v1/pets', {}, 200, [
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

                let result = await validateResponse('GET', 1, {}, 200, [
                    {
                        id: 123,
                        name: 111,
                        type: 'dog',
                    }
                ])
                
                expect(result.success).to.equal(false)
                expect(result.errors.length).to.equal(1)
                expect(result.errors[0].message).to.equal('Request validation failed')
                expect(initialised()).to.equal(true)
                expect(initialisationErrored()).to.equal(false)
            })

            it('when 400 error is returned that does not conform to schema', async () => {
                await initialise({ apiSpec: './specs/api.yaml', exitProcessWhenServiceIsStopped: false })

                let result = await validateResponse('GET', '/v1/pets', {}, 400, [
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
        })
        // happy response, errors blah, not initialised - done
        // test with ignoring case options etc on and off - done
        // error when required parameters not provided test - done
        // test with different status codes, methods etc
        // some routes have Error response type, test those too
        // test 5** 4** 2**
        // status codes that aren't in swagger and responses, they would use default I guess
    })

    describe('express server', () => {
        // test with env port, specific and random!
        // starting, stoping
        // readiness endpoint 
    })
})