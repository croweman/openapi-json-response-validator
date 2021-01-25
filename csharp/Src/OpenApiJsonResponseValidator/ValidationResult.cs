using System.Collections.Generic;
using Newtonsoft.Json;

namespace OpenApiJsonResponseValidator
{
    public class ValidationResult
    {
        [JsonProperty("valid")]
        public bool Valid { get; set; }
        
        [JsonProperty("errors")]
        public List<string> Errors { get; set; } = new List<string>();
    }
}