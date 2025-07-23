using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using DotNet.Flow.Abstractions;

namespace DotNet.Flow.Resolvers
{
    public class MediatRSymbolResolver : ISymbolResolver
    {
        private readonly Solution _solution;
        private readonly Dictionary<ITypeSymbol, List<INamedTypeSymbol>> _handlerCache;

        public MediatRSymbolResolver(Solution solution)
        {
            _solution = solution ?? throw new ArgumentNullException(nameof(solution));
            _handlerCache = new Dictionary<ITypeSymbol, List<INamedTypeSymbol>>(SymbolEqualityComparer.Default);
        }

        public bool CanResolve(IMethodSymbol method)
        {
            var containingType = method.ContainingType;
            return containingType.Name == "IMediator" || 
                   containingType.Name == "ISender" ||
                   (containingType.Name == "Mediator" && method.Name == "Send");
        }

        public async Task<IEnumerable<ResolvedMethod>> ResolveAsync(
            InvocationExpressionSyntax invocation, 
            SemanticModel semanticModel, 
            IMethodSymbol invokedMethod)
        {
            var requestType = GetMediatRRequestType(invocation, semanticModel);
            if (requestType == null)
                return Enumerable.Empty<ResolvedMethod>();

            var handlers = await FindHandlersForRequestAsync(requestType);
            var resolvedMethods = new List<ResolvedMethod>();

            foreach (var handler in handlers)
            {
                var handleMethod = handler.GetMembers("Handle")
                    .OfType<IMethodSymbol>()
                    .FirstOrDefault(m => m.MethodKind == MethodKind.Ordinary);

                if (handleMethod != null)
                {
                    resolvedMethods.Add(new ResolvedMethod
                    {
                        Method = handleMethod,
                        HandlerType = "MediatR",
                        RequestType = requestType.Name
                    });
                }
            }

            return resolvedMethods;
        }

        private ITypeSymbol GetMediatRRequestType(InvocationExpressionSyntax invocation, SemanticModel semanticModel)
        {
            var argumentList = invocation.ArgumentList;
            if (argumentList.Arguments.Count > 0)
            {
                var firstArg = argumentList.Arguments[0].Expression;
                var typeInfo = semanticModel.GetTypeInfo(firstArg);
                return typeInfo.Type;
            }
            return null;
        }

        private async Task<IEnumerable<INamedTypeSymbol>> FindHandlersForRequestAsync(ITypeSymbol requestType)
        {
            if (_handlerCache.TryGetValue(requestType, out var cached))
                return cached;

            var handlers = new List<INamedTypeSymbol>();

            foreach (var project in _solution.Projects)
            {
                if (project.Name.Contains("Test", StringComparison.OrdinalIgnoreCase))
                    continue;

                var compilation = await project.GetCompilationAsync();
                if (compilation == null)
                    continue;

                var allTypes = compilation.GetSymbolsWithName(_ => true, SymbolFilter.Type)
                    .OfType<INamedTypeSymbol>();

                foreach (var type in allTypes)
                {
                    if (IsHandlerForRequest(type, requestType, compilation))
                    {
                        handlers.Add(type);
                    }
                }
            }

            // Check base types and interfaces
            if (requestType is INamedTypeSymbol namedRequestType)
            {
                var baseType = namedRequestType.BaseType;
                while (baseType != null && baseType.SpecialType != SpecialType.System_Object)
                {
                    var baseHandlers = await FindHandlersForRequestAsync(baseType);
                    handlers.AddRange(baseHandlers);
                    baseType = baseType.BaseType;
                }

                foreach (var @interface in namedRequestType.AllInterfaces)
                {
                    var interfaceHandlers = await FindHandlersForRequestAsync(@interface);
                    handlers.AddRange(interfaceHandlers);
                }
            }

            _handlerCache[requestType] = handlers.Distinct(SymbolEqualityComparer.Default).Cast<INamedTypeSymbol>().ToList();
            return _handlerCache[requestType];
        }

        private bool IsHandlerForRequest(INamedTypeSymbol type, ITypeSymbol requestType, Compilation compilation)
        {
            if (type.IsAbstract)
                return false;

            // Check direct interfaces
            foreach (var @interface in type.AllInterfaces)
            {
                if (@interface.IsGenericType && 
                    (@interface.Name == "IRequestHandler" || @interface.Name == "IRequestHandler`2"))
                {
                    var typeArgs = @interface.TypeArguments;
                    if (typeArgs.Length > 0)
                    {
                        var handledRequestType = typeArgs[0];
                        
                        if (SymbolEqualityComparer.Default.Equals(handledRequestType, requestType) ||
                            IsAssignableFrom(requestType, handledRequestType, compilation))
                        {
                            return true;
                        }
                    }
                }
            }

            // Check if any base class implements the handler interface
            var currentBase = type.BaseType;
            while (currentBase != null && currentBase.SpecialType != SpecialType.System_Object)
            {
                foreach (var @interface in currentBase.AllInterfaces)
                {
                    if (@interface.IsGenericType && 
                        (@interface.Name == "IRequestHandler" || @interface.Name == "IRequestHandler`2"))
                    {
                        var typeArgs = @interface.TypeArguments;
                        if (typeArgs.Length > 0)
                        {
                            var handledRequestType = typeArgs[0];
                            
                            if (SymbolEqualityComparer.Default.Equals(handledRequestType, requestType) ||
                                IsAssignableFrom(requestType, handledRequestType, compilation))
                            {
                                return true;
                            }
                        }
                    }
                }
                currentBase = currentBase.BaseType;
            }

            return false;
        }

        private bool IsAssignableFrom(ITypeSymbol derived, ITypeSymbol baseType, Compilation compilation)
        {
            if (SymbolEqualityComparer.Default.Equals(derived, baseType))
                return true;

            if (derived is INamedTypeSymbol namedDerived)
            {
                var current = namedDerived.BaseType;
                while (current != null)
                {
                    if (SymbolEqualityComparer.Default.Equals(current, baseType))
                        return true;
                    current = current.BaseType;
                }

                foreach (var @interface in namedDerived.AllInterfaces)
                {
                    if (SymbolEqualityComparer.Default.Equals(@interface, baseType))
                        return true;
                }
            }

            return false;
        }
    }
}