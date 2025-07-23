using System.Text.Json;
using System.Text.Json.Serialization;

namespace DotNet.Flow.Models
{
    public class CallTreeNode
    {
        public MethodInfo Method { get; }
        public FileLocation? Location { get; }
        public bool IsUserCode { get; }
        public NodeMetadata Metadata { get; }
        public List<CallTreeNode> Children { get; }

        public CallTreeNode(
            MethodInfo method, 
            FileLocation? location, 
            bool isUserCode, 
            NodeMetadata? metadata = null)
        {
            Method = method ?? throw new ArgumentNullException(nameof(method));
            Location = location;
            IsUserCode = isUserCode;
            Metadata = metadata ?? new NodeMetadata();
            Children = new List<CallTreeNode>();
        }

        [JsonIgnore]
        public bool HasNonConstructorMethods
        {
            get
            {
                if (!Method.IsConstructor && !Method.IsPropertyAccessor)
                    return true;

                return Children.Any(child => child.HasNonConstructorMethods);
            }
        }

        public string ToJson()
        {
            var options = new JsonSerializerOptions 
            { 
                WriteIndented = true,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            };
            return JsonSerializer.Serialize(this, options);
        }
    }

    public class NodeMetadata
    {
        public bool IsMediatRHandler { get; set; }
        public string RequestType { get; set; }
        public string HandlerType { get; set; }
        public Dictionary<string, object> CustomData { get; set; } = new Dictionary<string, object>();
    }
}
