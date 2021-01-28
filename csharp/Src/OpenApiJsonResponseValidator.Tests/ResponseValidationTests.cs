using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;
using NUnit.Framework;

namespace OpenApiJsonResponseValidator.Tests
{
    [TestFixture]
    public class ResponseValidationTests
    {
        [TearDown]
        public void TearDown()
        {
            ResponseValidation.Dispose();
            Bash("docker-compose down");
        }
        
        [TestCase(null)]
        [TestCase("")]
        public async Task InitialiseFailsIfTheResponseValidationUriIsInvalid(string responseValidationUri)
        {
            await Setup();

            try
            {
                await ResponseValidation.Initialise(responseValidationUri);
                Assert.Fail("Fail");
            }
            catch (Exception e)
            {
                Assert.That(e.Message, Is.EqualTo("You must define the responseValidationUri"));
            }
        }
        
        [Test]
        public async Task InitialiseShouldThrowAnErrorIfTheResponseValidationServiceIsNotAvailable()
        {
            await Setup("./docker-compose-invalid-api.yml", false);

            try
            {
                await ResponseValidation.Initialise("http://localhost:3010/");
                Assert.Fail("Fail");
            }
            catch (Exception e)
            {
                Assert.That(e.Message, Is.EqualTo("An error occurred while trying to initialise. An error occurred while sending the request."));
            }
        }

        [Test]
        public async Task ValidateResponseValidShouldBeTrueWhenResponseConformsToOpenApiSpecWithEmptyArray()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>(), new List<object>());
            
            Assert.That(validationResult.Valid, Is.True);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(0));
        }
        
        [Test]
        public async Task ValidateResponseValidShouldBeTrueWhenResponseConformsToOpenApiSpecWithPopulatedArray()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");
            
            var json = new List<object>
            {
                new
                {
                    id = 1,
                    name = "bob",
                    type = "dog"
                }
            };

            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>(), json);
            
            Assert.That(validationResult.Valid, Is.True);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(0));
        }
        
        [Test]
        public async Task ValidateResponseValidShouldBeTrueWhenResponseConformsToOpenApiSpecWithPopulatedArrayFromJsonString()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            var jsonString = "[{\"id\":1,\"name\":\"bob\",\"type\":\"dog\"}]";
            var json = JsonConvert.DeserializeObject(jsonString);

            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>(), json);
            
            Assert.That(validationResult.Valid, Is.True);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(0));
        }
        
        [Test]
        public async Task ValidateResponseValidShouldBeTrueWhenResponseConformsToOpenApiSpecWhenUsingRequestAndResponseOverload()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");
            
            var request = new HttpRequestMessage(HttpMethod.Get, new Uri("http://localhost/v1/pets"));
            var response = new HttpResponseMessage(HttpStatusCode.OK) {Content = new StringContent("[]")};

            var validationResult = await ResponseValidation.ValidateResponse(request, response);
            
            Assert.That(validationResult.Valid, Is.True);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(0));
        }

        [Test]
        public async Task ValidateResponseValidShouldBeFalseWhenResponseDoesNotConformToOpenApiSpec_1()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            var json = new List<object>
            {
                new { dayOfWeek = "Monday" }
            };
            
            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>(), json);
            
            Assert.That(validationResult.Valid, Is.False);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(4));
            Assert.That(validationResult.Errors[0], Is.EqualTo("{\"path\":\".response[0].dayOfWeek\",\"message\":\"should NOT have additional properties\",\"errorCode\":\"additionalProperties.openapi.validation\"}"));
            Assert.That(validationResult.Errors[1], Is.EqualTo("{\"path\":\".response[0].id\",\"message\":\"should have required property 'id'\",\"errorCode\":\"required.openapi.validation\"}"));
            Assert.That(validationResult.Errors[2], Is.EqualTo("{\"path\":\".response[0].name\",\"message\":\"should have required property 'name'\",\"errorCode\":\"required.openapi.validation\"}"));
            Assert.That(validationResult.Errors[3], Is.EqualTo("{\"path\":\".response[0].type\",\"message\":\"should have required property 'type'\",\"errorCode\":\"required.openapi.validation\"}"));
        }

        [Test]
        public async Task ValidateResponseValidShouldBeFalseWhenResponseDoesNotConformToOpenApiSpec_2()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            var json = new { dayOfWeek = "Monday" };

            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>(), json);
            
            Assert.That(validationResult.Valid, Is.False);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(1));
            Assert.That(validationResult.Errors[0], Is.EqualTo("{\"path\":\".response\",\"message\":\"should be array\",\"errorCode\":\"type.openapi.validation\"}"));
        }
        
        [Test]
        public async Task ValidateResponseValidShouldBeFalseWhenResponseDoesNotConformToOpenApiSpec_3_NoJson()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>());
            
            Assert.That(validationResult.Valid, Is.False);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(1));
            Assert.That(validationResult.Errors[0], Is.EqualTo("{\"path\":\".response\",\"message\":\"response body required.\"}"));
        }
        
        [Test]
        public async Task ValidateResponseThrowsAnExceptionWhenNotInitialised()
        {
            try
            {
                await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                    new Dictionary<string, string>(), new List<object>());
                Assert.Fail("Fail");
            }
            catch (Exception e)
            {
                Assert.That(e.Message, Is.EqualTo("You have not initialised the ResponseValidation object"));
            }
        }
        
        [Test]
        public async Task ValidateResponseThrowsAnExceptionWhenMethodIsNotDefined()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            try
            {
                await ResponseValidation.ValidateResponse(null, "/v1/pets", HttpStatusCode.OK,
                    new Dictionary<string, string>(), new List<object>());
                Assert.Fail("Fail");
            }
            catch (Exception e)
            {
                Assert.That(e.Message, Is.EqualTo("You must define a method"));
            }
        }
        
        [Test]
        public async Task ValidateResponseThrowsAnExceptionWhenPathIsNotDefined()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            try
            {
                await ResponseValidation.ValidateResponse(HttpMethod.Get, "", HttpStatusCode.OK,
                    new Dictionary<string, string>(), new List<object>());
                Assert.Fail("Fail");
            }
            catch (Exception e)
            {
                Assert.That(e.Message, Is.EqualTo("You must define a path"));
            }
        }

        [Test]
        public async Task AssertThatResponseIsValidThrowsNoErrorWhenTheResponseConformsToTheSpecificationUsingRequestAndResponseOverloads()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");
            
            var request = new HttpRequestMessage(HttpMethod.Get, new Uri("http://localhost/v1/pets"));
            var response = new HttpResponseMessage(HttpStatusCode.OK) {Content = new StringContent("[]")};

            await ResponseValidation.AssertThatResponseIsValid(request, response);
        }
        
        [Test]
        public async Task AssertThatResponseIsValidThrowsNoErrorWhenTheResponseConformsToTheSpecification()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            await ResponseValidation.AssertThatResponseIsValid(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK, null, new object[]{});
        }

        [Test]
        public async Task AssertThatResponseIsValidThrowsAnErrorWhenTheResponseDoesNotConformToTheSpecificationUsingRequestAndResponseOverloads()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, new Uri("http://localhost/v1/pets"));
                var response = new HttpResponseMessage(HttpStatusCode.OK) {Content = new StringContent("")};

                await ResponseValidation.AssertThatResponseIsValid(request, response);
                throw new Exception("Fail");
            }
            catch (Exception e)
            {
                Assert.That(e.Message, Is.EqualTo("Response validation failed with the following errors: {\"path\":\".response\",\"message\":\"response body required.\"}."));
            }
        }
        
        [Test]
        public async Task AssertThatResponseIsValidThrowsAnErrorWhenTheResponseDoesNotConformToTheSpecification()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            try
            {
                await ResponseValidation.AssertThatResponseIsValid(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK, null, "");
                throw new Exception("Fail");
            }
            catch (Exception e)
            {
                Assert.That(e.Message, Is.EqualTo("Response validation failed with the following errors: {\"path\":\".response\",\"message\":\"should be array\",\"errorCode\":\"type.openapi.validation\"}."));
            }
        }

        private static void Bash(string cmd)
        {
            var escapedArgs = cmd.Replace("\"", "\\\"");

            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    WorkingDirectory = Directory.GetCurrentDirectory(),
                    FileName = "/bin/bash",
                    Arguments = $"-c \"{escapedArgs}\"",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                }
            };

            process.Start();
            process.StandardOutput.ReadToEnd();
            process.WaitForExit();
        }
        
        private async Task Setup(string dockerComposeFileName = "./docker-compose-valid-api.yml", bool waitForReadiness = true)
        {
            Bash($"docker-compose -f {dockerComposeFileName} up -d");

            var connected = false;
            var client = new HttpClient();

            var attempts = 0;

            while (attempts < 100)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(100));

                try
                {
                    var response = await client.GetAsync("http://localhost:3010/readiness");

                    if (response.IsSuccessStatusCode)
                    {
                        connected = true;
                        break;
                    }
                }
                catch (Exception e)
                {
                    // do nothing
                }

                if (!waitForReadiness) break;
            }

            if (!connected && waitForReadiness)
                throw new Exception("Docker container never became ready");
        }
    }
}