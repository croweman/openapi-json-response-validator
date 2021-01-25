using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading;
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
            Bash("docker-compose down");
        }

        [Test]
        public async Task ValidShouldBeTrueWhenResponseConformsToOpenApiSpec()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>(), new List<object>());
            
            Assert.That(validationResult.Valid, Is.True);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(0));
        }
        
        [Test]
        public async Task ValidShouldBeFalseWhenResponseDoesNotConformToOpenApiSpec_1()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            var json = new List<object>
            {
                new { dayOfWeek = "Monday" }
            };
            
            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>(), json);
            
            Console.WriteLine(JsonConvert.SerializeObject(validationResult));
            Assert.That(validationResult.Valid, Is.False);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(4));
            Assert.That(validationResult.Errors[0], Is.EqualTo("{\"path\":\".response[0].dayOfWeek\",\"message\":\"should NOT have additional properties\",\"errorCode\":\"additionalProperties.openapi.validation\"}"));
            Assert.That(validationResult.Errors[1], Is.EqualTo("{\"path\":\".response[0].id\",\"message\":\"should have required property 'id'\",\"errorCode\":\"required.openapi.validation\"}"));
            Assert.That(validationResult.Errors[2], Is.EqualTo("{\"path\":\".response[0].name\",\"message\":\"should have required property 'name'\",\"errorCode\":\"required.openapi.validation\"}"));
            Assert.That(validationResult.Errors[3], Is.EqualTo("{\"path\":\".response[0].type\",\"message\":\"should have required property 'type'\",\"errorCode\":\"required.openapi.validation\"}"));
        }
        
        [Test]
        public async Task ValidShouldBeFalseWhenResponseDoesNotConformToOpenApiSpec_2()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            var json = new { dayOfWeek = "Monday" };

            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>(), json);
            
            Console.WriteLine(JsonConvert.SerializeObject(validationResult));
            Assert.That(validationResult.Valid, Is.False);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(1));
            Assert.That(validationResult.Errors[0], Is.EqualTo("{\"path\":\".response\",\"message\":\"should be array\",\"errorCode\":\"type.openapi.validation\"}"));
        }
        
        [Test]
        public async Task ValidShouldBeFalseWhenResponseDoesNotConformToOpenApiSpec_3_NoJson()
        {
            await Setup();
            
            await ResponseValidation.Initialise("http://localhost:3010/");

            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get, "/v1/pets", HttpStatusCode.OK,
                new Dictionary<string, string>());
            
            Console.WriteLine(JsonConvert.SerializeObject(validationResult));
            Assert.That(validationResult.Valid, Is.False);
            Assert.That(validationResult.Errors.Count, Is.EqualTo(1));
            Assert.That(validationResult.Errors[0], Is.EqualTo("{\"path\":\".response\",\"message\":\"response body required.\"}"));
        }
        
        [Test]
        public async Task ShouldThrowAnErrorIfTheResponseValidationServiceIsNotAvailable()
        {
            await Setup("./docker-compose-invalid-api.yml", false);

            try
            {
                await ResponseValidation.Initialise("http://localhost:3010/");
                Assert.Fail("Fail");
            }
            catch (Exception e)
            {
                Assert.That(e.Message, Is.EqualTo("An error occurred while trying to initialise"));
            }
        }

        private static void Bash(string cmd)
        {
            var escapedArgs = cmd.Replace("\"", "\\\"");

            Console.WriteLine(Directory.GetCurrentDirectory());

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
            var result = process.StandardOutput.ReadToEnd();
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
                Thread.Sleep(TimeSpan.FromMilliseconds(100));

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