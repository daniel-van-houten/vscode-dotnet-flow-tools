using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace DotNet.Flow.Abstractions
{
    public interface ISymbolResolver
    {
        bool CanResolve(IMethodSymbol method);
        Task<IEnumerable<ResolvedMethod>> ResolveAsync(
            InvocationExpressionSyntax invocation, 
            SemanticModel semanticModel, 
            IMethodSymbol invokedMethod);
    }

    public class ResolvedMethod
    {
        public IMethodSymbol Method { get; set; }
        public string HandlerType { get; set; }
        public string RequestType { get; set; }
    }
}