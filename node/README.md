# openapi-json-response-validator

API that utilises the [express-openapi-validator](#https://www.npmjs.com/package/express-openapi-validator) middleware to validate that JSON responses conform to an **OpenAPI 3** specification.

The API will expose a REST micro service to perform the validation.

## Table of contents

- [Prerequisites](#prerequisites)
- [Install](#install)
- [Use](#use)
  - [initialise](#initialise)
  - [dispose](#dispose)
  - [validateResponse](#validateresponse)
  - [Validate Response Http Request](#validateresponsehttp)
- [License](#license)

---

## Prerequisites<a name="prerequisites"></a>

`openapi-json-response-validator` is built with <a href="https://nodejs.org/en/">nodejs</a> and has the following dependencies.

- <a href="https://nodejs.org/en/">nodejs</a>, the minimum supported `LTS` version is `8.9.0`.

---

## Install<a name="install"></a>

```
npm install `openapi-json-response-validator` --save
```

---

## initialise<a name="initialise"></a>

To make use of the api you will first need to initialise it with an open api specification.

```js
const { initialise } = require('openapi-json-response-validator')

let port

try {
    port = await initialise({ apiSpec: './api.yaml' })
} catch(err) {
    console.log('An error occurred while trying to initialise validator', err)
}
```

The options that can be provided on initialisation are below.

### options
 - `apiSpec`: (required) Defines the file containing the open api 3 specification.
 - `port`: (optional) Defines the port to expose the micro service on. By default a random free port will be used.  The port can also be defined using the `OPENAPI_JSON_RESPONSE_VALIDATOR_PORT` environment variable.

If initialisation is successful the port the micro service is exposed on will be returned.

If initialisation fails an error will be thrown.

---

## dispose<a name="dispose"></a>

Will stop the micro service if one has been exposed.

```js
const { dispose } = require('openapi-json-response-validator')

dispose()
```

---

## validateResponse<a name="validateresponse"></a>

You will firstly need to successfully initialise before you can call validateResponse.


```js
const { validateResponse } = require('openapi-json-response-validator')

try {
    const result = await validateResponse('GET', '/v1/pets', { 'Cache-Control': 'no-cache' }, 200, [
        {
            id: 123,
            name: 'joe',
            type: 'dog'
        }
    ])
    
    if (result.success) {
        console.log('the response conforms to the schema')
    } else {
        console.log('validation failed', result.errors)
    }
} catch(err) {
    console.log('An error occurred while trying to validate a response', err)
}
```

The parameters that can be provided on initialisation are below.

### options
 - `method`: (required) The http method.
 - `path`: (required) The request path.
 - `statusCode`: (required) The http status code.
 - `headers`: (required) The response headers as an object.
 - `json`: (optional) Object or array.

Will throw an error if something went wrong

---

## Validate Response Http Request<a name="validateresponsehttp"></a>

```js
const axios = require('axios')
const { initialise } = require('openapi-json-response-validator')

const port = await initialise({ apiSpec: './api.yaml' })

try {
    const response = await axios.post(`http://localhost:${port}/validate-response`, {
        method: 'GET',
        path: '/v1/pets',
        statusCode: 200,            
        headers: { 'Cache-Control': 'no-cache' },
        json: [
          {
              id: 123,
              name: 'joe',
              type: 'dog'
          }
      ]
    })

    if (response.status === 200) {
        if (response.data.success === true)
            console.log('Validation passed')
        else
            console.log('Validation failed', response.data.errors)
    } else {
        throw new Error('Something went wrong trying to validate the response')
    }    
    
} catch (err) {
    console.log(err)
}
```

---

## License<a name="license"></a>

(The MIT License)

Copyright (c) 2021 `Lee Crowe` a.k.a. `croweman`

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


