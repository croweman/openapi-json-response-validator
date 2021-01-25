using System;
using System.Collections.Generic;
using System.Data;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace OpenApiJsonResponseValidator
{
    public static class ResponseValidation
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
                throw new Exception($"You must define the {responseValidationUri}");

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
                throw new Exception("An error occurred while trying to initialise");
            }
        }

        // do we need overload that takes a response object?
        // what if already read the content?
        // what type is json? object?
        /// <summary>
        /// Validates a http response
        /// </summary>
        /// <param name="method">Http method</param>
        /// <param name="path">Request path</param>
        /// <param name="statusCode">Response status code</param>
        /// <param name="headers">Response headers</param>
        /// <param name="json">Json content (object or null).  A string should not be supplied!</param>
        /// <returns>A ValidationResult</returns>
        /// <exception cref="Exception"></exception>
        public static async Task<ValidationResult> ValidateResponse(
            HttpMethod method,
            string path,
            HttpStatusCode statusCode,
            Dictionary<string, string> headers,
            object json = null)
        {
            if (!_initialised)
                throw new Exception($"You have not initialised the {nameof(ResponseValidation)} object");
            
            if (method == null)
                throw new Exception($"You must define a {nameof(method)}");
            
            if (string.IsNullOrWhiteSpace(path))
                throw new Exception($"You must define a {path}");
            
            if (headers == null)
                throw new Exception($"You must define {headers}");

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, $"{_responseValidationUri}/validate-response");

                var body = new
                {
                    method = method.ToString().ToUpper(),
                    path,
                    statusCode = (int) statusCode,
                    headers,
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
    }
}