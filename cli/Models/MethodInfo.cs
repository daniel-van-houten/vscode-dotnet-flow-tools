namespace DotNet.Flow.Models
{
    public class MethodInfo
    {
        public string Name { get; }
        public string ClassName { get; }
        public string FullName { get; }
        public bool IsConstructor { get; }
        public bool IsPropertyAccessor { get; }

        public MethodInfo(string name, string className, string fullName)
        {
            Name = name ?? throw new ArgumentNullException(nameof(name));
            ClassName = className ?? throw new ArgumentNullException(nameof(className));
            FullName = fullName ?? throw new ArgumentNullException(nameof(fullName));
            
            IsConstructor = name.StartsWith("new ") || name.StartsWith(".ctor") || name.Contains(".ctor");
            IsPropertyAccessor = name.StartsWith("get_") || name.StartsWith("set_") ||
                               name.Contains(".get_") || name.Contains(".set_");
        }

        public string GetSimplifiedName()
        {
            var lastDot = FullName.LastIndexOf('.');
            var openParen = FullName.IndexOf('(');
            
            if (lastDot >= 0 && openParen > lastDot)
            {
                var methodWithParams = FullName.Substring(lastDot + 1);
                return SimplifyParameters(methodWithParams);
            }
            
            return SimplifyParameters(FullName);
        }

        private string SimplifyParameters(string methodSignature)
        {
            var openParen = methodSignature.IndexOf('(');
            var closeParen = methodSignature.LastIndexOf(')');
            
            if (openParen == -1 || closeParen == -1 || openParen >= closeParen)
            {
                return methodSignature;
            }
            
            var methodName = methodSignature.Substring(0, openParen);
            var parametersSection = methodSignature.Substring(openParen + 1, closeParen - openParen - 1);
            
            if (string.IsNullOrWhiteSpace(parametersSection))
            {
                return methodName + "()";
            }
            
            var parameters = parametersSection.Split(',');
            var parameterNames = new List<string>();
            
            foreach (var param in parameters)
            {
                var trimmed = param.Trim();
                if (string.IsNullOrEmpty(trimmed))
                    continue;
                    
                var parts = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length > 0)
                {
                    parameterNames.Add(parts[parts.Length - 1]);
                }
            }
            
            return methodName + "(" + string.Join(", ", parameterNames) + ")";
        }

        public override bool Equals(object? obj)
        {
            if (obj is MethodInfo other)
            {
                return FullName == other.FullName && ClassName == other.ClassName;
            }
            return false;
        }

        public override int GetHashCode()
        {
            return HashCode.Combine(FullName, ClassName);
        }
    }
}
