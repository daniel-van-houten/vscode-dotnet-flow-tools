using Microsoft.CodeAnalysis;
using DotNet.Flow.Abstractions;
using DotNet.Flow.Models;
using System.Text;

namespace DotNet.Flow.Formatters
{
    public class CodeOutputFormatter : IOutputFormatter
    {
        public string Name => "Code";
        public bool RequiresSaving => false;

        public async Task FormatAsync(CallTreeNode root, OutputContext context)
        {
            var allNodes = new List<CallTreeNode>();
            CollectAllNodes(root, allNodes);

            // Filter to only include actual methods when methodsOnly is true
            if (context.MethodsOnly)
            {
                allNodes = allNodes.Where(n => 
                    n.IsUserCode && 
                    n.Location != null &&
                    !string.IsNullOrEmpty(n.Location.FilePath) &&
                    !n.Method.IsConstructor && 
                    !n.Method.IsPropertyAccessor
                ).ToList();
            }

            // Get unique methods, preserving the original traversal order
            var uniqueMethods = allNodes
                .Where(n => n.IsUserCode && n.Location != null && !string.IsNullOrEmpty(n.Location.FilePath))
                .GroupBy(n => new { n.Location.FilePath, n.Method.ClassName, n.Method.Name })
                .Select(g => g.First())
                .ToList();

            var codeOutput = new StringBuilder();
            
            // Add code begin marker
            codeOutput.AppendLine("<!--CODE-BEGIN-->");
            
            // Cache for file contents
            var fileContents = new Dictionary<string, Microsoft.CodeAnalysis.Text.TextLineCollection>();

            // Collect all valid methods first to handle separators properly
            var allMethods = new List<(CallTreeNode node, Microsoft.CodeAnalysis.Text.TextLineCollection lines)>();
            
            foreach (var node in uniqueMethods)
            {
                var lines = await GetLinesAsync(node.Location.FilePath, context, fileContents);
                if (lines == null) continue;

                // Skip if this looks like a whole class definition instead of just a method
                if (context.MethodsOnly && LooksLikeClassDefinition(lines, node.Location))
                {
                    continue;
                }
                
                allMethods.Add((node, lines));
            }
            
            // Output all methods with combined separator/info markers
            for (int i = 0; i < allMethods.Count; i++)
            {
                var (node, lines) = allMethods[i];
                
                // Add combined separator with file, class, and method info
                codeOutput.AppendLine($"<!--### File: {node.Location.FileName} Class: {node.Method.ClassName} Method: {node.Method.GetSimplifiedName()} -->");
                
                // Find the minimum indentation of the method body
                int minIndentation = int.MaxValue;
                for (int j = node.Location.StartLine - 1; j < Math.Min(node.Location.EndLine, lines.Count); j++)
                {
                    var line = lines[j].ToString();
                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        int currentIndentation = line.Length - line.TrimStart().Length;
                        if (currentIndentation < minIndentation)
                        {
                            minIndentation = currentIndentation;
                        }
                    }
                }

                // Print the method body with adjusted indentation
                for (int j = node.Location.StartLine - 1; j < Math.Min(node.Location.EndLine, lines.Count); j++)
                {
                    var line = lines[j].ToString();
                    if (line.Length > minIndentation)
                    {
                        codeOutput.AppendLine(line.Substring(minIndentation));
                    }
                    else
                    {
                        codeOutput.AppendLine(line);
                    }
                }
                codeOutput.AppendLine();
            }
            
            // Add code end marker
            codeOutput.AppendLine("<!--CODE-END-->");
            
            // Output to writer
            var writer = context.OutputWriter ?? Console.Out;
            await writer.WriteAsync(codeOutput.ToString());
        }

        private async Task<Microsoft.CodeAnalysis.Text.TextLineCollection> GetLinesAsync(string filePath, OutputContext context, Dictionary<string, Microsoft.CodeAnalysis.Text.TextLineCollection> cache)
        {
            if (cache.TryGetValue(filePath, out var lines))
            {
                return lines;
            }

            var documentId = context.Solution.GetDocumentIdsWithFilePath(filePath).FirstOrDefault();
            if (documentId == null) return null;

            var doc = context.Solution.GetDocument(documentId);
            if (doc == null) return null;

            var text = await doc.GetTextAsync();
            lines = text.Lines;
            cache[filePath] = lines;
            return lines;
        }

        private void CollectAllNodes(CallTreeNode node, List<CallTreeNode> allNodes)
        {
            if (node == null) return;
            
            allNodes.Add(node);
            foreach (var child in node.Children)
            {
                CollectAllNodes(child, allNodes);
            }
        }

        private bool LooksLikeClassDefinition(Microsoft.CodeAnalysis.Text.TextLineCollection lines, FileLocation location)
        {
            if (location == null) return false;
            
            var startLine = location.StartLine - 1;
            var endLine = location.EndLine - 1;

            // Check if the range contains class/struct definition markers
            for (int i = startLine; i <= endLine && i < lines.Count; i++)
            {
                var lineText = lines[i].ToString().Trim();
                
                // Look for class or struct definitions
                if (lineText.Contains("public class") || lineText.Contains("public struct") ||
                    lineText.Contains("internal class") || lineText.Contains("internal struct") ||
                    lineText.Contains("private class") || lineText.Contains("private struct") ||
                    lineText.Contains("protected class") || lineText.Contains("protected struct") ||
                    lineText.Contains("public partial class") || lineText.Contains("partial class"))
                {
                    // Also check if it contains property definitions
                    for (int j = i + 1; j <= endLine && j < lines.Count; j++)
                    {
                        var propLine = lines[j].ToString().Trim();
                        if (propLine.Contains("{ get; set; }") || propLine.Contains("{get;set;}"))
                        {
                            return true;
                        }
                    }
                }
            }
            
            return false;
        }
    }
}
