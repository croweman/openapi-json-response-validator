using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace OpenApiJsonResponseValidator
{
    public class Testing
    {
        public static async Task DoesEndpointReturnValidResponse()
        {
            var httpClient = new HttpClient();
            var response = await httpClient.GetAsync("http://localhost/v1/pets");
            var headers = ResponseValidation.GetResponseHeaders(response);
            var json = JsonConvert.DeserializeObject(await response.Content.ReadAsStringAsync());
            
            var validationResult = await ResponseValidation.ValidateResponse(HttpMethod.Get,
                "/v1/pets", HttpStatusCode.OK, headers, json);
            
            if (!validationResult.Valid)
            {
                foreach (var error in validationResult.Errors)
                    Console.WriteLine(error);
                
                throw new Exception("The response did not conform!");
            }
        }
    }
}