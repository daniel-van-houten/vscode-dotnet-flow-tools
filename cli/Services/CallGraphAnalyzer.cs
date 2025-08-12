using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using DotNet.Flow.Abstractions;
using DotNet.Flow.Models;

namespace DotNet.Flow.Services
{
    public class CallGraphAnalyzer : ICallGraphAnalyzer
    {
        private readonly Solution _solution;
        private readonly HashSet<IMethodSymbol> _visitedMethods;
        private readonly HashSet<string> _userCodeAssemblies;
        private readonly IEnumerable<ISymbolResolver> _symbolResolvers;
        private readonly bool _debug;

        public CallGraphAnalyzer(Solution solution, IEnumerable<ISymbolResolver> symbolResolvers, bool debug = false)
        {
            _solution = solution ?? throw new ArgumentNullException(nameof(solution));
            _symbolResolvers = symbolResolvers ?? throw new ArgumentNullException(nameof(symbolResolvers));
            _visitedMethods = new HashSet<IMethodSymbol>(SymbolEqualityComparer.Default);
            _userCodeAssemblies = new HashSet<string>();
            _debug = debug;
            InitializeUserCodeAssemblies();
        }

        public async Task<CallTreeNode> AnalyzeClassMethodAsync(string className, string methodName)
        {
            var compilation = await GetCompilationForClassAsync(className);
            if (compilation == null)
            {
                throw new InvalidOperationException($"Could not find class: {className}");
            }

            var classSymbol = FindClassType(compilation, className);
            if (classSymbol == null)
            {
                throw new InvalidOperationException($"Class {className} not found");
            }

            var method = classSymbol.GetMembers(methodName)
                .OfType<IMethodSymbol>()
                .FirstOrDefault(m => m.MethodKind == MethodKind.Ordinary);

            if (method == null)
            {
                throw new InvalidOperationException($"Method {methodName} not found in {className}");
            }

            return await AnalyzeMethodAsync(method);
        }

        public async Task<CallTreeNode> AnalyzeMethodAsync(IMethodSymbol method)
        {
            if (_visitedMethods.Contains(method))
                return null;

            _visitedMethods.Add(method);

            var methodInfo = CreateMethodInfo(method);
            var fileLocation = await GetFileLocationAsync(method);
            var node = new CallTreeNode(methodInfo, fileLocation, IsUserCode(method));

            if (!node.IsUserCode)
                return node;

            var methodSyntax = await GetMethodSyntaxAsync(method);
            if (methodSyntax == null)
                return node;

            var semanticModel = await GetSemanticModelAsync(method);
            if (semanticModel == null)
                return node;

            if (_debug)
            {
                var diagnostics = semanticModel.GetDiagnostics();
                var errors = diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error).ToArray();
                if (errors.Any())
                {
                    Console.WriteLine($"[CallGraphAnalyzer] Found {errors.Length} compilation errors:");
                    foreach (var error in errors.Take(5))
                    {
                        Console.WriteLine($"[CallGraphAnalyzer] Error: {error.GetMessage()}");
                    }
                }
            }

            await AnalyzeMethodBodyAsync(methodSyntax, semanticModel, node);
            
            return node;
        }

        private async Task AnalyzeMethodBodyAsync(SyntaxNode methodSyntax, SemanticModel semanticModel, CallTreeNode parentNode)
        {
            // Process all invocations in the method, including those in control flow statements
            await AnalyzeInvocationsInNodeAsync(methodSyntax, semanticModel, parentNode);
        }

        private async Task AnalyzeInvocationsInNodeAsync(SyntaxNode node, SemanticModel semanticModel, CallTreeNode parentNode)
        {
            // Analyze method invocations
            var invocations = node.DescendantNodes().OfType<InvocationExpressionSyntax>();
            
            if (_debug)
            {
                Console.WriteLine($"[CallGraphAnalyzer] Found {invocations.Count()} invocations in node");
            }
            
            foreach (var invocation in invocations)
            {
                var symbolInfo = semanticModel.GetSymbolInfo(invocation);
                var invokedSymbol = symbolInfo.Symbol as IMethodSymbol;
                
                if (_debug)
                {
                    Console.WriteLine($"[CallGraphAnalyzer] Invocation syntax: {invocation.Expression}");
                    Console.WriteLine($"[CallGraphAnalyzer] Symbol: {symbolInfo.Symbol?.ToDisplayString() ?? "null"}");
                    
                    if (symbolInfo.CandidateSymbols.Length > 0)
                    {
                        Console.WriteLine($"[CallGraphAnalyzer] Candidate symbols ({symbolInfo.CandidateSymbols.Length}):");
                        foreach (var candidate in symbolInfo.CandidateSymbols.Take(3))
                        {
                            Console.WriteLine($"[CallGraphAnalyzer]   - {candidate.ToDisplayString()}");
                        }
                    }
                }
                
                if (invokedSymbol == null)
                {
                    // Try using candidate symbols if available
                    if (symbolInfo.CandidateSymbols.Length > 0)
                    {
                        invokedSymbol = symbolInfo.CandidateSymbols.FirstOrDefault() as IMethodSymbol;
                        if (_debug && invokedSymbol != null)
                        {
                            Console.WriteLine($"[CallGraphAnalyzer] Using candidate symbol: {invokedSymbol.ToDisplayString()}");
                        }
                    }
                    
                    if (invokedSymbol == null)
                    {
                        if (_debug)
                        {
                            Console.WriteLine("[CallGraphAnalyzer] Skipping null symbol");
                        }
                        continue;
                    }
                }

                // Skip methods we don't want to trace (like Dispose)
                if (ShouldSkipMethod(invokedSymbol))
                {
                    if (_debug)
                    {
                        Console.WriteLine($"[CallGraphAnalyzer] Skipping filtered method: {invokedSymbol.Name}");
                    }
                    continue;
                }

                if (_debug)
                {
                    Console.WriteLine($"[CallGraphAnalyzer] Analyzing invocation: {invokedSymbol.ContainingType.Name}.{invokedSymbol.Name}");
                }

                // Try symbol resolvers first
                bool handled = false;
                foreach (var resolver in _symbolResolvers)
                {
                    if (resolver.CanResolve(invokedSymbol))
                    {
                        var resolvedMethods = await resolver.ResolveAsync(invocation, semanticModel, invokedSymbol);
                        foreach (var resolved in resolvedMethods)
                        {
                            var childNode = await AnalyzeMethodAsync(resolved.Method);
                            if (childNode != null)
                            {
                                if (!string.IsNullOrEmpty(resolved.HandlerType))
                                {
                                    childNode.Metadata.IsMediatRHandler = true;
                                    childNode.Metadata.HandlerType = resolved.HandlerType;
                                    childNode.Metadata.RequestType = resolved.RequestType;
                                }
                                parentNode.Children.Add(childNode);
                            }
                        }
                        handled = true;
                        break;
                    }
                }

                if (!handled && IsUserCode(invokedSymbol))
                {
                    var childNode = await AnalyzeMethodAsync(invokedSymbol);
                    if (childNode != null)
                        parentNode.Children.Add(childNode);
                }
            }

            // Analyze object creations
            var objectCreations = node.DescendantNodes().OfType<ObjectCreationExpressionSyntax>();
            foreach (var creation in objectCreations)
            {
                var ctorSymbol = semanticModel.GetSymbolInfo(creation).Symbol as IMethodSymbol;
                if (ctorSymbol != null && IsUserCode(ctorSymbol))
                {
                    var childNode = await AnalyzeMethodAsync(ctorSymbol);
                    if (childNode != null)
                        parentNode.Children.Add(childNode);
                }
            }
        }

        private MethodInfo CreateMethodInfo(IMethodSymbol method)
        {
            var fullName = method.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat);
            return new MethodInfo(method.Name, method.ContainingType.Name, fullName);
        }

        private async Task<FileLocation> GetFileLocationAsync(IMethodSymbol method)
        {
            var location = method.Locations.FirstOrDefault();
            if (location == null || !location.IsInSource)
                return null;

            var methodSyntax = await GetMethodSyntaxAsync(method);
            if (methodSyntax != null && location.SourceTree != null)
            {
                var lineSpan = location.SourceTree.GetLineSpan(methodSyntax.Span);
                return new FileLocation(
                    location.SourceTree.FilePath,
                    lineSpan.StartLinePosition.Line + 1,
                    lineSpan.EndLinePosition.Line + 1
                );
            }
            else if (location != null)
            {
                var lineSpan = location.GetLineSpan();
                return new FileLocation(
                    location.SourceTree?.FilePath,
                    lineSpan.StartLinePosition.Line + 1,
                    lineSpan.EndLinePosition.Line + 1
                );
            }

            return null;
        }

        private void InitializeUserCodeAssemblies()
        {
            foreach (var project in _solution.Projects)
            {
                if (project.Name.Contains("Test", StringComparison.OrdinalIgnoreCase) ||
                    project.Name.Contains(".Tests", StringComparison.OrdinalIgnoreCase))
                    continue;

                _userCodeAssemblies.Add(project.AssemblyName);
            }
        }

        private async Task<Compilation> GetCompilationForClassAsync(string className)
        {
            foreach (var project in _solution.Projects)
            {
                if (project.Name.Contains("Test", StringComparison.OrdinalIgnoreCase))
                    continue;

                var compilation = await project.GetCompilationAsync();
                var classType = FindClassType(compilation, className);
                if (classType != null)
                    return compilation;
            }
            return null;
        }

        private INamedTypeSymbol FindClassType(Compilation compilation, string className)
        {
            return compilation.GetSymbolsWithName(
                name => name.Equals(className, StringComparison.OrdinalIgnoreCase),
                SymbolFilter.Type)
                .OfType<INamedTypeSymbol>()
                .FirstOrDefault();
        }


        private async Task<SyntaxNode> GetMethodSyntaxAsync(IMethodSymbol method)
        {
            var location = method.Locations.FirstOrDefault();
            if (location == null || !location.IsInSource)
                return null;

            var document = _solution.GetDocument(location.SourceTree);
            if (document == null)
                return null;

            var root = await document.GetSyntaxRootAsync();
            return root?.FindNode(location.SourceSpan);
        }

        private async Task<SemanticModel> GetSemanticModelAsync(IMethodSymbol method)
        {
            var location = method.Locations.FirstOrDefault();
            if (location == null || !location.IsInSource)
                return null;

            var document = _solution.GetDocument(location.SourceTree);
            return document == null ? null : await document.GetSemanticModelAsync();
        }

        private bool IsUserCode(ISymbol symbol)
        {
            return symbol.ContainingAssembly != null && 
                   _userCodeAssemblies.Contains(symbol.ContainingAssembly.Name);
        }

        private bool ShouldSkipMethod(IMethodSymbol method)
        {
            if (IsUserCode(method)) return false;
            if (method.Parameters.Length != 0) return false;

            switch (method.Name)
            {
                case "Dispose":
                case "DisposeAsync":
                case "Close":
                case "Abort":
                    return true;
                default:
                    return false;
            }
        }
    }
}
