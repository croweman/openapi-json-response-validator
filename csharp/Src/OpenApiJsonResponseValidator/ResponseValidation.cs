using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace OpenApiJsonResponseValidator
{
    /// <summary>
    /// Validates http responses against a service Open Api 3 specification
    /// </summary>
    public class ResponseValidation
    {
        private static bool _initialised;
        private static HttpClient _client;
        private static string _responseValidationUri;
        
        /// <summary>
        /// Initialise the object
        /// </summary>
        /// <param name="responseValidationUri">Uri to the response validation service</param>
        /// <returns></returns>
        /// <exception cref="Exception"></exception>
        public static async Task Initialise(string responseValidationUri)
        {
            if (responseValidationUri != null && responseValidationUri.EndsWith("/"))
                responseValidationUri = responseValidationUri.Substring(0, responseValidationUri.Length - 1);
            
            if (string.IsNullOrWhiteSpace(responseValidationUri))
                throw new Exception($"You must define the {nameof(responseValidationUri)}");

            _responseValidationUri = null;
            _initialised = false;
            _client = new HttpClient();

            try
            {
                var readinessUri = $"{responseValidationUri}/readiness";
                var request = new HttpRequestMessage(HttpMethod.Get, readinessUri);

                var response = await _client.SendAsync(request);
                
                if (response.StatusCode != HttpStatusCode.OK)
                    throw new Exception($"Unexpected {response.StatusCode} status code was returned from {readinessUri}");
                
                _initialised = true;
                _responseValidationUri = responseValidationUri;
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
                throw new Exception($"An error occurred while trying to initialise. {e.Message}");
            }
        }
        
        /// <summary>
        /// Validates a http response
        /// </summary>
        /// <param name="request">HttpRequestMessage</param>
        /// <param name="response">HttpResponseMessage</param>
        /// <returns>A ValidationResult</returns>
        /// <exception cref="Exception"></exception>
        public static async Task<ValidationResult> ValidateResponse(HttpRequestMessage request,
            HttpResponseMessage response)
        {
            var headers = GetResponseHeaders(response);
            var json = JsonConvert.DeserializeObject(await response.Content.ReadAsStringAsync());

            return await ValidateResponse(request.Method, request.RequestUri.AbsolutePath, response.StatusCode, headers, json);
        }
        
        /// <summary>
        /// Validates a http response
        /// </summary>
        /// <param name="method">Http method</param>
        /// <param name="path">Request path</param>
        /// <param name="statusCode">Response status code</param>
        /// <param name="headers">Response headers (optional)</param>
        /// <param name="json">Json content (object or null).  A string should not be supplied!</param>
        /// <returns>A ValidationResult</returns>
        /// <exception cref="Exception"></exception>
        public static async Task<ValidationResult> ValidateResponse(
            HttpMethod method,
            string path,
            HttpStatusCode statusCode,
            Dictionary<string, string> headers = null,
            object json = null)
        {
            if (!_initialised)
                throw new Exception($"You have not initialised the {nameof(ResponseValidation)} object");
            
            if (method == null)
                throw new Exception($"You must define a {nameof(method)}");
            
            if (string.IsNullOrWhiteSpace(path))
                throw new Exception($"You must define a {nameof(path)}");

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, $"{_responseValidationUri}/validate-response");

                var body = new
                {
                    method = method.ToString().ToUpper(),
                    path,
                    statusCode = (int) statusCode,
                    headers = headers ?? new Dictionary<string, string>(),
                    json
                };

                request.Content = new StringContent(JsonConvert.SerializeObject(body), System.Text.Encoding.UTF8, "application/json");

                var response = await _client.SendAsync(request);
                
                if (response.StatusCode != HttpStatusCode.OK)
                    throw new Exception($"Unexpected status code {response.StatusCode} was returned");
                
                var result = JObject.Parse(await response.Content.ReadAsStringAsync());

                var validationResult = new ValidationResult
                {
                    Valid = result["valid"].Value<bool>() 
                };
                
                foreach (var error in result["errors"] as JArray)
                {
                    var value = error.Value<object>();

                    if (!(value is string))
                        value = JsonConvert.SerializeObject(value);

                    validationResult.Errors.Add(value.ToString());
                }

                return validationResult;
            }
            catch (Exception e)
            {
                Console.WriteLine(e);

                return new ValidationResult
                {
                    Valid = false,
                    Errors = new List<string>
                    {
                        e.ToString()
                    }
                };
            }
        }
        
        /// <summary>
        /// Asserts that the http response is valid
        /// </summary>
        /// <param name="method">Http method</param>
        /// <param name="path">Request path</param>
        /// <param name="statusCode">Response status code</param>
        /// <param name="headers">Response headers (optional)</param>
        /// <param name="json">Json content (object or null).  A string should not be supplied!</param>
        /// <exception cref="Exception"></exception>
        public static async Task AssertThatResponseIsValid(
            HttpMethod method,
            string path,
            HttpStatusCode statusCode,
            Dictionary<string, string> headers = null,
            object json = null)
        {
            var validationResult = await ValidateResponse(method, path, statusCode, headers, json);

            ProcessValidationResult(validationResult);
        }
        
        /// <summary>
        /// Asserts that the http response is valid
        /// </summary>
        /// <param name="request">HttpRequestMessage</param>
        /// <param name="response">HttpResponseMessage</param>
        /// <exception cref="Exception"></exception>
        public static async Task AssertThatResponseIsValid(HttpRequestMessage request,
            HttpResponseMessage response)
        {
            var validationResult = await ValidateResponse(request, response);

            ProcessValidationResult(validationResult);
        }

        /// <summary>
        /// Converts response headers to a dictionary
        /// </summary>
        /// <param name="response">HttpResponseMessage</param>
        /// <returns>A dictionary containing response headers</returns>
        public static Dictionary<string, string> GetResponseHeaders(HttpResponseMessage response)
        {
            return response?.Headers is null ? new Dictionary<string, string>() : response.Headers.ToDictionary(header => header.Key, header => header.Value.FirstOrDefault() ?? string.Empty);
        }

        /// <summary>
        /// Disposes of dependencies
        /// </summary>
        public static void Dispose()
        {
            _initialised = false;
            _responseValidationUri = null;
            
            if (_client is object)
                _client.Dispose();
        }

        private static void ProcessValidationResult(ValidationResult validationResult)
        {
            if (validationResult.Valid) return;

            var errorMessage = "Response validation failed with the following errors:";

            foreach (var error in validationResult.Errors)
                errorMessage += $" {error}.";

            throw new Exception(errorMessage);
        }
    }
}