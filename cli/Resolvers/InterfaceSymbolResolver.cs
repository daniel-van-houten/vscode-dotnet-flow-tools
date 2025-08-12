using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.FindSymbols;
using DotNet.Flow.Abstractions;

namespace DotNet.Flow.Resolvers
{
    public class InterfaceSymbolResolver : ISymbolResolver
    {
        private readonly Solution _solution;
        private readonly Dictionary<ITypeSymbol, List<INamedTypeSymbol>> _implementationCache;
        private readonly bool _debug;

        public InterfaceSymbolResolver(Solution solution, bool debug = false)
        {
            _solution = solution ?? throw new ArgumentNullException(nameof(solution));
            _implementationCache = new Dictionary<ITypeSymbol, List<INamedTypeSymbol>>(SymbolEqualityComparer.Default);
            _debug = debug;
        }

        public bool CanResolve(IMethodSymbol method)
        {
            var containingType = method.ContainingType;
            if (containingType?.TypeKind != TypeKind.Interface)
                return false;
            
            // Don't handle MediatR interfaces - let MediatRSymbolResolver handle those
            var typeName = containingType.Name;
            var namespaceName = containingType.ContainingNamespace?.ToDisplayString() ?? "";
            var isMediatRInterface = (typeName == "IMediator" || typeName == "ISender") ||
                                   namespaceName.Contains("MediatR", StringComparison.OrdinalIgnoreCase);
            
            if (isMediatRInterface)
            {
                if (_debug)
                {
                    Console.WriteLine($"[InterfaceResolver] Skipping MediatR interface: {containingType.Name}.{method.Name}");
                }
                return false;
            }
            
            var canResolve = true;
            
            if (_debug && canResolve)
            {
                Console.WriteLine($"[InterfaceResolver] Can resolve interface method: {containingType.Name}.{method.Name}");
            }
            
            return canResolve;
        }

        public async Task<IEnumerable<ResolvedMethod>> ResolveAsync(
            InvocationExpressionSyntax invocation, 
            SemanticModel semanticModel, 
            IMethodSymbol invokedMethod)
        {
            var interfaceType = invokedMethod.ContainingType;
            
            if (_debug)
            {
                Console.WriteLine($"[InterfaceResolver] Resolving implementations for: {interfaceType.Name}.{invokedMethod.Name}");
            }

            var implementations = await FindImplementationsAsync(interfaceType);
            var resolvedMethods = new List<ResolvedMethod>();

            foreach (var implementation in implementations)
            {
                if (_debug)
                {
                    Console.WriteLine($"[InterfaceResolver] Found implementation: {implementation.Name}");
                }

                var implementedMethod = FindImplementedMethod(implementation, invokedMethod);
                
                if (implementedMethod != null)
                {
                    if (_debug)
                    {
                        Console.WriteLine($"[InterfaceResolver] Found method: {implementation.Name}.{implementedMethod.Name}");
                    }

                    resolvedMethods.Add(new ResolvedMethod
                    {
                        Method = implementedMethod,
                        HandlerType = string.Empty,
                        RequestType = string.Empty
                    });
                }
            }

            if (_debug)
            {
                Console.WriteLine($"[InterfaceResolver] Resolved {resolvedMethods.Count} implementation(s)");
            }

            return resolvedMethods;
        }

        private async Task<IEnumerable<INamedTypeSymbol>> FindImplementationsAsync(ITypeSymbol interfaceType)
        {
            if (_implementationCache.TryGetValue(interfaceType, out var cached))
            {
                return cached;
            }

            var implementations = new List<INamedTypeSymbol>();

            try
            {
                var allImplementations = await SymbolFinder.FindImplementationsAsync(
                    interfaceType, 
                    _solution, 
                    cancellationToken: default);

                foreach (var impl in allImplementations)
                {
                    if (impl is INamedTypeSymbol namedType && 
                        namedType.TypeKind == TypeKind.Class &&
                        !namedType.IsAbstract)
                    {
                        implementations.Add(namedType);
                    }
                }
            }
            catch (Exception ex)
            {
                if (_debug)
                {
                    Console.WriteLine($"[InterfaceResolver] Error finding implementations: {ex.Message}");
                }
            }

            if (implementations.Count == 0 && _debug)
            {
                Console.WriteLine($"[InterfaceResolver] No implementations found for {interfaceType.Name}, falling back to manual search");
                implementations = await FindImplementationsManuallyAsync(interfaceType);
            }

            _implementationCache[interfaceType] = implementations;
            return implementations;
        }

        private async Task<List<INamedTypeSymbol>> FindImplementationsManuallyAsync(ITypeSymbol interfaceType)
        {
            var implementations = new List<INamedTypeSymbol>();

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
                    if (type.TypeKind == TypeKind.Class && 
                        !type.IsAbstract &&
                        ImplementsInterface(type, interfaceType))
                    {
                        implementations.Add(type);
                        
                        if (_debug)
                        {
                            Console.WriteLine($"[InterfaceResolver] Found implementation via manual search: {type.Name}");
                        }
                    }
                }
            }

            return implementations;
        }

        private bool ImplementsInterface(INamedTypeSymbol type, ITypeSymbol interfaceType)
        {
            foreach (var implementedInterface in type.AllInterfaces)
            {
                if (SymbolEqualityComparer.Default.Equals(implementedInterface, interfaceType))
                {
                    return true;
                }

                if (implementedInterface.OriginalDefinition != null && 
                    interfaceType is INamedTypeSymbol namedInterface &&
                    namedInterface.OriginalDefinition != null &&
                    SymbolEqualityComparer.Default.Equals(
                        implementedInterface.OriginalDefinition, 
                        namedInterface.OriginalDefinition))
                {
                    return true;
                }
            }

            return false;
        }

        private IMethodSymbol FindImplementedMethod(INamedTypeSymbol implementation, IMethodSymbol interfaceMethod)
        {
            var members = implementation.GetMembers(interfaceMethod.Name)
                .OfType<IMethodSymbol>()
                .Where(m => m.MethodKind == MethodKind.Ordinary);

            foreach (var member in members)
            {
                var explicitImplementations = member.ExplicitInterfaceImplementations;
                if (explicitImplementations.Any())
                {
                    foreach (var explicitImpl in explicitImplementations)
                    {
                        if (SymbolEqualityComparer.Default.Equals(explicitImpl, interfaceMethod) ||
                            AreMethodsEquivalent(explicitImpl, interfaceMethod))
                        {
                            return member;
                        }
                    }
                }
                else
                {
                    if (AreMethodsEquivalent(member, interfaceMethod))
                    {
                        return member;
                    }
                }
            }

            var interfaceMap = implementation.AllInterfaces
                .SelectMany(i => i.GetMembers().OfType<IMethodSymbol>())
                .Where(m => SymbolEqualityComparer.Default.Equals(m, interfaceMethod))
                .FirstOrDefault();

            if (interfaceMap != null)
            {
                var implSymbol = implementation.FindImplementationForInterfaceMember(interfaceMethod);
                if (implSymbol is IMethodSymbol methodImpl)
                {
                    return methodImpl;
                }
            }

            return null;
        }

        private bool AreMethodsEquivalent(IMethodSymbol method1, IMethodSymbol method2)
        {
            if (method1.Name != method2.Name)
                return false;

            if (method1.Parameters.Length != method2.Parameters.Length)
                return false;

            for (int i = 0; i < method1.Parameters.Length; i++)
            {
                var param1 = method1.Parameters[i];
                var param2 = method2.Parameters[i];

                if (!AreTypesEquivalent(param1.Type, param2.Type))
                    return false;
            }

            return AreTypesEquivalent(method1.ReturnType, method2.ReturnType);
        }

        private bool AreTypesEquivalent(ITypeSymbol type1, ITypeSymbol type2)
        {
            if (SymbolEqualityComparer.Default.Equals(type1, type2))
                return true;

            if (type1.Name == type2.Name && 
                type1.ContainingNamespace?.ToDisplayString() == type2.ContainingNamespace?.ToDisplayString())
                return true;

            if (type1 is INamedTypeSymbol named1 && type2 is INamedTypeSymbol named2)
            {
                if (named1.IsGenericType && named2.IsGenericType &&
                    named1.TypeArguments.Length == named2.TypeArguments.Length)
                {
                    if (!SymbolEqualityComparer.Default.Equals(named1.OriginalDefinition, named2.OriginalDefinition))
                        return false;

                    for (int i = 0; i < named1.TypeArguments.Length; i++)
                    {
                        if (!AreTypesEquivalent(named1.TypeArguments[i], named2.TypeArguments[i]))
                            return false;
                    }
                    return true;
                }
            }

            return false;
        }
    }
}