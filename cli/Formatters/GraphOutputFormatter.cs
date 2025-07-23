using DotNet.Flow.Abstractions;
using DotNet.Flow.Models;

namespace DotNet.Flow.Formatters
{
    public class GraphOutputFormatter : IOutputFormatter
    {
        public string Name => "Graph";
        public bool RequiresSaving => false;

        public Task FormatAsync(CallTreeNode root, OutputContext context)
        {
            var writer = context.OutputWriter ?? Console.Out;
            
            // Add call graph begin marker
            writer.WriteLine("<!--CALL-GRAPH-BEGIN-->");
            
            var filteredRoot = context.MethodsOnly ? FilterMethodsOnly(root) : root;
            
            if (filteredRoot != null)
            {
                PrintNode(writer, filteredRoot, "", true, true);
            }
            else
            {
                writer.WriteLine("No methods found (all nodes were constructors or properties)");
            }

            // Add call graph end marker
            writer.WriteLine("<!--CALL-GRAPH-END-->");

            return Task.CompletedTask;
        }

        private void PrintNode(TextWriter writer, CallTreeNode node, string indent, bool isLast, bool isRoot = false)
        {
            if (node == null) return;

            var marker = isLast ? "└─> " : "├─> ";
            var connector = isLast ? "    " : "│   ";

            if (!isRoot)
            {
                writer.Write(indent + marker);
            }
            
            // Add type indicators
            var className = node.Method.ClassName;
            if (IsController(className))
            {
                writer.Write("[Controller] ");
            }
            else if (node.Metadata.IsMediatRHandler)
            {
                writer.Write("[Handler] ");
            }
            else if (IsDto(node))
            {
                writer.Write("[DTO] ");
            }

            // Print class and method
            writer.Write($"{className}");
            
            var methodName = node.Method.GetSimplifiedName();
            if (!node.Method.IsConstructor)
            {
                writer.Write($".{methodName}");
            }
            else
            {
                writer.Write($" {methodName}");
            }

            // Add file and line info
            if (node.Location != null)
            {
                writer.Write($"  // {node.Location.ToLocationString()}");
            }

            writer.WriteLine();

            var childIndent = isRoot ? "" : indent + connector;

            for (int i = 0; i < node.Children.Count; i++)
            {
                PrintNode(writer, node.Children[i], childIndent, i == node.Children.Count - 1, false);
            }
        }

        private bool IsController(string className)
        {
            return className.EndsWith("Controller", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsDto(CallTreeNode node)
        {
            return !node.HasNonConstructorMethods;
        }

        private CallTreeNode FilterMethodsOnly(CallTreeNode node)
        {
            if (node == null) return null;

            if (node.Method.IsConstructor || node.Method.IsPropertyAccessor)
            {
                bool hasMethodChildren = node.Children.Any(child => child.HasNonConstructorMethods);
                
                if (!hasMethodChildren)
                {
                    return null;
                }
            }

            var filteredChildren = new List<CallTreeNode>();
            foreach (var child in node.Children)
            {
                var filteredChild = FilterMethodsOnly(child);
                if (filteredChild != null)
                {
                    filteredChildren.Add(filteredChild);
                }
            }

            if (filteredChildren.Count == 0 && (node.Method.IsConstructor || node.Method.IsPropertyAccessor))
            {
                return null;
            }

            var filteredNode = new CallTreeNode(node.Method, node.Location, node.IsUserCode, node.Metadata);
            foreach (var child in filteredChildren)
            {
                filteredNode.Children.Add(child);
            }
            return filteredNode;
        }
    }
}
