using Microsoft.CodeAnalysis;
using DotNet.Flow.Models;

namespace DotNet.Flow.Abstractions
{
    public interface IOutputFormatter
    {
        Task FormatAsync(CallTreeNode root, OutputContext context);
        string Name { get; }
        bool RequiresSaving { get; }
    }

    public class OutputContext
    {
        public Solution Solution { get; set; }
        public string ClassName { get; set; }
        public string MethodName { get; set; }
        public bool MethodsOnly { get; set; }
        public bool HandlersOnly { get; set; }
        public TextWriter OutputWriter { get; set; }
        public string OutputPath { get; set; }
    }
}