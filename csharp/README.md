# OpenApiJsonResponseValidator

c# API that utilises the Node.js <a href="../node">openapi-json-response-validator</a> to validate that JSON responses conform to an **OpenAPI 3** specification.

The Node.js micro service can be exposed natively in `Node.js` or <a href="../docker">Docker</a>.

## Table of contents

- [Prerequisites](#prerequisites)
- [Install](#install)
- [Use](#use)
  - [Initialise](#initialise)
  - [ValidateResponse](#validateresponse)
- [License](#license)

---

## Prerequisites<a name="prerequisites"></a>

Is built with c# and is dependent on .NET Standard 2.0.

---

## Install<a name="install"></a>

Install from [nuget](https://www.nuget.org/packages/OpenApiJsonResponseValidator/).

---

## Initialise<a name="initialise"></a>

To make use of the api you will firstly need to initialise it.

```c#
using OpenApiJsonResponseValidator;

public static async Task InitialiseTheValidator()
{
    try
    {
        await ResponseValidation.Initialise("http://localhost:3010");
    }
    catch (Exception e)
    {
        Console.WriteLine($"An error occurred while initialising the response validator. {e.Message}");
        throw;
    }
}
```

The options that can be provided on initialisation are below.

### options
 - `responseValidationUri`: (required) Defines the uri to the response validation micro service.

---

## ValidateResponse<a name="validateresponse"></a>

You will firstly need to successfully `Initialise` before you can call `ValidateResponse`.

```c#
using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using OpenApiJsonResponseValidator;
using Newtonsoft.Json;

public static async Task DoesEndpointReturnValidResponse()
{
    var httpClient = new HttpClient();
    var response = await httpClient.GetAsync("http://localhost/v1/pets");
    var headers = ResponseValidation.GetResponseHeaders(response);
    var json = JsonConvert.DeserializeObject(await response.Content.ReadAsStringAsync());
    
    var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get,
        "/v1/pets", HttpStatusCode.OK, headers, json);
    
    if (validationResult.Valid)
    {
        Console.WriteLine("Validation Passed");
        return;
    }

    Console.WriteLine("Validation Failed:");
    
    foreach (var error in validationResult.Errors)
        Console.WriteLine(error);
        
    throw new Exception("The response did not conform!");
}
```

The parameters that can be provided to ValidateResponse are below.

### options
 - `method`: (required) The HttpMethod.
 - `path`: (required) The request path.
 - `statusCode`: (required) The HttpStatusCode.
 - `headers`: (optional) The response headers.
 - `json`: (optional) Object to be serialized to json.

---

## License<a name="license"></a>

(The MIT License)

Copyright (c) 2021 `Lee Crowe` a.k.a. `croweman`

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

