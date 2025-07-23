using Microsoft.CodeAnalysis;
using DotNet.Flow.Models;

namespace DotNet.Flow.Abstractions
{
    public interface ICallGraphAnalyzer
    {
        Task<CallTreeNode> AnalyzeClassMethodAsync(string className, string methodName);
        Task<CallTreeNode> AnalyzeMethodAsync(IMethodSymbol method);
    }
}