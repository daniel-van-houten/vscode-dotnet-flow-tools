using DotNet.Flow.Abstractions;
using DotNet.Flow.Models;

namespace DotNet.Flow.Filters
{
    public class HandlerOnlyFilter : ICallTreeFilter
    {
        public string Name => "HandlersOnly";
        public string Description => "Filters to show only Handle methods and connects them directly";

        public CallTreeNode Filter(CallTreeNode node)
        {
            if (node == null) return null;

            // Only include nodes that are Handle methods or lead to Handle methods
            var handleNodes = FindHandleNodes(node);
            if (handleNodes.Count == 0) return null;

            // If this is a Handle method, create a filtered node with direct connections to other Handle methods
            if (IsHandleMethod(node))
            {
                var filteredNode = new CallTreeNode(node.Method, node.Location, node.IsUserCode, node.Metadata);
                
                // Add only Handle method descendants
                foreach (var handleChild in handleNodes)
                {
                    if (handleChild != node) // Don't add self
                    {
                        filteredNode.Children.Add(handleChild);
                    }
                }
                
                return filteredNode;
            }
            
            // If this is not a Handle method but has Handle descendants, create a virtual root
            // that contains all top-level handlers (preserves sequential handler calls)
            if (handleNodes.Count == 1)
            {
                return handleNodes.First();
            }
            else if (handleNodes.Count > 1)
            {
                // Create a virtual root node that contains all handlers at this level
                var virtualRoot = new CallTreeNode(node.Method, node.Location, node.IsUserCode, node.Metadata);
                virtualRoot.Children.AddRange(handleNodes);
                return virtualRoot;
            }
            
            return null;
        }

        private bool IsHandleMethod(CallTreeNode node)
        {
            // Check if the method name is exactly "Handle"
            return node.Method.Name == "Handle";
        }

        private List<CallTreeNode> FindHandleNodes(CallTreeNode node)
        {
            var handleNodes = new List<CallTreeNode>();
            
            if (IsHandleMethod(node))
            {
                // Create a new node for this Handle method
                var handleNode = new CallTreeNode(node.Method, node.Location, node.IsUserCode, node.Metadata);
                
                // Recursively find all Handle methods in descendants
                var descendantHandleNodes = new List<CallTreeNode>();
                foreach (var child in node.Children)
                {
                    descendantHandleNodes.AddRange(FindHandleNodes(child));
                }
                
                // Add descendant Handle nodes as direct children
                handleNode.Children.AddRange(descendantHandleNodes);
                handleNodes.Add(handleNode);
            }
            else
            {
                // This is not a Handle method, so look for Handle methods in children
                foreach (var child in node.Children)
                {
                    handleNodes.AddRange(FindHandleNodes(child));
                }
            }
            
            return handleNodes;
        }
    }
}