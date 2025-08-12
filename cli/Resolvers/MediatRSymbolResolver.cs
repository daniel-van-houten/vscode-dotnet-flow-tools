using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using DotNet.Flow.Abstractions;

namespace DotNet.Flow.Resolvers
{
    public class MediatRSymbolResolver : ISymbolResolver
    {
        private readonly Solution _solution;
        private readonly Dictionary<ITypeSymbol, List<INamedTypeSymbol>> _handlerCache;
        private readonly bool _debug;

        public MediatRSymbolResolver(Solution solution, bool debug = false)
        {
            _solution = solution ?? throw new ArgumentNullException(nameof(solution));
            _handlerCache = new Dictionary<ITypeSymbol, List<INamedTypeSymbol>>(SymbolEqualityComparer.Default);
            _debug = debug;
        }

        public bool CanResolve(IMethodSymbol method)
        {
            var containingType = method.ContainingType;
            
            // Check method name first - this is the most important criteria
            var methodName = method.IsGenericMethod ? method.OriginalDefinition.Name : method.Name;
            if (methodName != "Send" && methodName != "Publish")
            {
                return false;
            }
            
            // Check if this is a MediatR type (interface or implementation)
            // Be more permissive - check namespace and interface implementations
            var typeName = containingType.Name;
            var isMediatrType = typeName == "IMediator" || 
                               typeName == "ISender" ||
                               typeName == "Mediator" ||
                               containingType.AllInterfaces.Any(i => i.Name == "IMediator" || i.Name == "ISender");
            
            // Also check if the containing namespace suggests this is MediatR
            var namespaceName = containingType.ContainingNamespace?.ToDisplayString() ?? "";
            var isMediatRNamespace = namespaceName.Contains("MediatR", StringComparison.OrdinalIgnoreCase);
            
            var canResolve = isMediatrType || isMediatRNamespace;
            
            if (_debug)
            {
                if (canResolve)
                {
                    Console.WriteLine($"[MediatRResolver] Can resolve MediatR method: {containingType.Name}.{method.Name}");
                    if (method.IsGenericMethod)
                    {
                        Console.WriteLine($"[MediatRResolver] Generic method with {method.TypeArguments.Length} type arguments");
                    }
                }
                else if (methodName == "Send" || methodName == "Publish")
                {
                    Console.WriteLine($"[MediatRResolver] Found {methodName} method but type {containingType.Name} is not recognized as MediatR");
                    Console.WriteLine($"[MediatRResolver] Namespace: {namespaceName}");
                }
            }
            
            return canResolve;
        }

        public async Task<IEnumerable<ResolvedMethod>> ResolveAsync(
            InvocationExpressionSyntax invocation, 
            SemanticModel semanticModel, 
            IMethodSymbol invokedMethod)
        {
            if (_debug)
            {
                Console.WriteLine($"[MediatRResolver] Resolving method: {invokedMethod.ToDisplayString()}");
            }

            var requestType = GetMediatRRequestType(invocation, semanticModel, invokedMethod);
            if (requestType == null)
            {
                if (_debug)
                {
                    Console.WriteLine("[MediatRResolver] Could not determine request type");
                }
                return Enumerable.Empty<ResolvedMethod>();
            }

            if (_debug)
            {
                Console.WriteLine($"[MediatRResolver] Request type: {requestType.ToDisplayString()}");
            }

            var handlers = await FindHandlersForRequestAsync(requestType);
            var resolvedMethods = new List<ResolvedMethod>();

            foreach (var handler in handlers)
            {
                var handleMethod = handler.GetMembers("Handle")
                    .OfType<IMethodSymbol>()
                    .FirstOrDefault(m => m.MethodKind == MethodKind.Ordinary);

                if (handleMethod != null)
                {
                    if (_debug)
                    {
                        Console.WriteLine($"[MediatRResolver] Found handler: {handler.Name}.Handle");
                    }

                    resolvedMethods.Add(new ResolvedMethod
                    {
                        Method = handleMethod,
                        HandlerType = "MediatR",
                        RequestType = requestType.Name
                    });
                }
            }

            if (_debug)
            {
                Console.WriteLine($"[MediatRResolver] Resolved {resolvedMethods.Count} handler(s)");
            }

            return resolvedMethods;
        }

        private ITypeSymbol GetMediatRRequestType(InvocationExpressionSyntax invocation, SemanticModel semanticModel, IMethodSymbol method)
        {
            // First try to get the request type from the method's type arguments (for generic Send<TResponse>)
            if (method.IsGenericMethod && method.TypeArguments.Length > 0)
            {
                if (_debug)
                {
                    Console.WriteLine($"[MediatRResolver] Checking generic method type arguments");
                }

                // For Send<TResponse>, we need to look at the first argument to get the request type
                var argumentList = invocation.ArgumentList;
                if (argumentList.Arguments.Count > 0)
                {
                    var firstArg = argumentList.Arguments[0].Expression;
                    var typeInfo = semanticModel.GetTypeInfo(firstArg);
                    
                    if (_debug && typeInfo.Type != null)
                    {
                        Console.WriteLine($"[MediatRResolver] Request type from argument: {typeInfo.Type.ToDisplayString()}");
                    }
                    
                    return typeInfo.Type;
                }
            }
            
            // Fallback to regular argument inspection
            var args = invocation.ArgumentList;
            if (args.Arguments.Count > 0)
            {
                var firstArg = args.Arguments[0].Expression;
                var typeInfo = semanticModel.GetTypeInfo(firstArg);
                
                if (_debug && typeInfo.Type != null)
                {
                    Console.WriteLine($"[MediatRResolver] Request type from argument (fallback): {typeInfo.Type.ToDisplayString()}");
                }
                
                return typeInfo.Type;
            }
            
            if (_debug)
            {
                Console.WriteLine("[MediatRResolver] Could not extract request type from invocation");
            }
            
            return null;
        }

        private async Task<IEnumerable<INamedTypeSymbol>> FindHandlersForRequestAsync(ITypeSymbol requestType)
        {
            if (_handlerCache.TryGetValue(requestType, out var cached))
            {
                if (_debug)
                {
                    Console.WriteLine($"[MediatRResolver] Using cached handlers for {requestType.Name} ({cached.Count} handler(s))");
                }
                return cached;
            }

            if (_debug)
            {
                Console.WriteLine($"[MediatRResolver] Searching for handlers of {requestType.ToDisplayString()}");
            }

            var handlers = new List<INamedTypeSymbol>();

            foreach (var project in _solution.Projects)
            {
                if (project.Name.Contains("Test", StringComparison.OrdinalIgnoreCase))
                    continue;

                var compilation = await project.GetCompilationAsync();
                if (compilation == null)
                    continue;

                if (_debug)
                {
                    Console.WriteLine($"[MediatRResolver] Searching in project: {project.Name}");
                }

                var allTypes = compilation.GetSymbolsWithName(_ => true, SymbolFilter.Type)
                    .OfType<INamedTypeSymbol>();

                foreach (var type in allTypes)
                {
                    if (IsHandlerForRequest(type, requestType, compilation))
                    {
                        handlers.Add(type);
                        if (_debug)
                        {
                            Console.WriteLine($"[MediatRResolver] Found handler: {type.Name}");
                        }
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