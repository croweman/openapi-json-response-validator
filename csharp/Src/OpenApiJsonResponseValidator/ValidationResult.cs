using System.Collections.Generic;
using Newtonsoft.Json;

namespace OpenApiJsonResponseValidator
{
    /// <summary>
    /// Response validation result
    /// </summary>
    public class ValidationResult
    {
        /// <summary>
        /// Indicates whether the response is valid
        /// </summary>
        [JsonProperty("valid")]
        public bool Valid { get; set; }
        
        /// <summary>
        /// Validation errors
        /// </summary>
        [JsonProperty("errors")]
        public List<string> Errors { get; set; } = new List<string>();
    }
}