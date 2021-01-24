const { initialise } = require('openapi-json-response-validator')

const go = async () => {
    await initialise({ apiSpec: './api.yaml' })   
}

go()
    .then(() => { 
        console.log('Ready to validate')
    })
    .catch((err) => {
        console.log('An error occurred', err)
        process.exit(1)
    })