using DotNet.Flow.Abstractions;
using DotNet.Flow.Models;

namespace DotNet.Flow.Filters
{
    public class MethodsOnlyFilter : ICallTreeFilter
    {
        public string Name => "MethodsOnly";
        public string Description => "Filters out constructors and property accessors, showing only actual methods";

        public CallTreeNode Filter(CallTreeNode node)
        {
            if (node == null) return null;

            // If this node is a constructor or property accessor with no method children, skip it
            if ((node.Method.IsConstructor || node.Method.IsPropertyAccessor) && 
                !node.HasNonConstructorMethods)
            {
                return null;
            }

            // Create a new filtered node
            var filteredNode = new CallTreeNode(node.Method, node.Location, node.IsUserCode, node.Metadata);

            // Filter children recursively
            foreach (var child in node.Children)
            {
                var filteredChild = Filter(child);
                if (filteredChild != null)
                {
                    filteredNode.Children.Add(filteredChild);
                }
            }

            // If after filtering children, this node has no children and is itself not a real method, skip it
            if (filteredNode.Children.Count == 0 && 
                (node.Method.IsConstructor || node.Method.IsPropertyAccessor))
            {
                return null;
            }

            return filteredNode;
        }
    }
}