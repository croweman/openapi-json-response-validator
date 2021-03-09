# OpenApiJsonResponseValidator

c# API that utilises the Node.js <a href="../node">openapi-json-response-validator</a> to validate that JSON responses conform to an **OpenAPI 3** specification.

The Node.js micro service can be exposed natively in `Node.js` or <a href="../docker">Docker</a>.

## Table of contents

- [Prerequisites](#prerequisites)
- [Install](#install)
- [Use](#use)
  - [Initialise](#initialise)
  - [ValidateResponse](#validateresponse)
  - [AssertThatResponseIsValid](#assert)
- [Using with Docker](#docker)
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
 
There is also another overload that accepts a HttpRequestMessage and HttpResponseMessage
 
```c#
using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using OpenApiJsonResponseValidator;
using Newtonsoft.Json;
 
public static async Task DoesEndpointReturnValidResponse()
{
    // example request and response objects
    var request = new HttpRequestMessage(HttpMethod.Get, new Uri("http://localhost/v1/pets"));
    var response = new HttpResponseMessage(HttpStatusCode.OK) {Content = new StringContent("")};
     
    var validationResult = await ResponseValidation.ValidateResponse(request, response);
}
```

---

## AssertThatResponseIsValid<a name="assert"></a>

You will firstly need to successfully `Initialise` before you can call `AssertThatResponseIsValid`.

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
    
    await ResponseValidation.AssertThatResponseIsValid(HttpMethod.Get,
        "/v1/pets", HttpStatusCode.OK, headers, json);
}
```

The parameters that can be provided to AssertThatResponseIsValid are below.

### options
 - `method`: (required) The HttpMethod.
 - `path`: (required) The request path.
 - `statusCode`: (required) The HttpStatusCode.
 - `headers`: (optional) The response headers.
 - `json`: (optional) Object to be serialized to json.
 
There is also another overload that accepts a HttpRequestMessage and HttpResponseMessage
 
```c#
using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using OpenApiJsonResponseValidator;
using Newtonsoft.Json;
 
public static async Task DoesEndpointReturnValidResponse()
{
    // example request and response objects
    var request = new HttpRequestMessage(HttpMethod.Get, new Uri("http://localhost/v1/pets"));
    var response = new HttpResponseMessage(HttpStatusCode.OK) {Content = new StringContent("")};
     
    await ResponseValidation.AssertThatResponseIsValid(request, response);
}
```

---

## Using with Docker<a name="docker"></a>

You may want your .net integration tests to spin up a docker containerised version of the OpenApi Json Response Validator service.

To do this you will need to firstly ensure:

1. You copy your swagger file `app.yaml` to the output directory of your test project.

2. You copy a file named `docker-compose-openapi-validation.yml` to the output directory of your test project which looks similar to:

```yml
version: '3'

services:

  app:
    image: croweman/openapi-json-response-validator:0.0.8
    restart: "on-failure:10"
    volumes:
      - ./app.yaml:/app/api.yaml
    ports:
      - "9001:9000"
    environment:
      OPENAPI_JSON_RESPONSE_VALIDATOR_PORT: 9000
```

3. Include a Test Fixture setup within your test code base to spin up and take down the validation service before and after tests have ran.

```c#
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using NUnit.Framework;
using OpenApiJsonResponseValidator;

[SetUpFixture]
public class FixtureSetup
{
    private const string OpenApiValidationUrl = "http://localhost:9001";

    [OneTimeSetUp]
    public async Task Setup()
    {
        ToggleOpenApiValidationContainer(true);
        await WaitForOpenApiValidationToBeReady();

        await ResponseValidation.Initialise(OpenApiValidationUrl);
    }

    [OneTimeTearDown]
    public void Teardown()
    {
        ToggleOpenApiValidationContainer(false);
    }

    private static void ToggleOpenApiValidationContainer(bool up)
    {
        var process = new Process
        {
            StartInfo =
            {
                WorkingDirectory = Directory.GetCurrentDirectory(),
                FileName = "docker-compose",
                Arguments = "-f docker-compose-openapi-validation.yml " + (up ? "up" : "down"),
                WindowStyle = ProcessWindowStyle.Hidden
            }
        };
        process.Start();

        if (!up)
            process.WaitForExit();
    }

    private static async Task WaitForOpenApiValidationToBeReady()
    {
        const int maxWaitTimeInMilliseconds = 20000;

        var ready = await CheckForOpenApiValidationReadiness();
        var stopwatch = Stopwatch.StartNew();

        while (!ready)
        {
            await Task.Delay(10);
            ready = await CheckForOpenApiValidationReadiness();

            if (stopwatch.ElapsedMilliseconds > maxWaitTimeInMilliseconds)
                throw new Exception("Open Api Json Validator never became ready");
        }
    }

    private static async Task<bool> CheckForOpenApiValidationReadiness()
    {
        var client = new HttpClient();

        try
        {
            var response = await client.GetAsync($"{OpenApiValidationUrl}/readiness");

            return response is object && response.StatusCode == HttpStatusCode.OK;
        }
        catch
        {
            return false;
        }
    }
}
```

---

## License<a name="license"></a>

(The MIT License)

Copyright (c) 2021 `Lee Crowe` a.k.a. `croweman`

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

