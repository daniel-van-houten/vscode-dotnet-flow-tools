using Microsoft.CodeAnalysis;
using DotNet.Flow.Abstractions;
using DotNet.Flow.Formatters;
using DotNet.Flow.Filters;
using DotNet.Flow.Resolvers;

namespace DotNet.Flow.Services
{
    public class ServiceContainer
    {
        private readonly Dictionary<Type, object> _services = new Dictionary<Type, object>();
        private readonly Dictionary<Type, Func<object>> _factories = new Dictionary<Type, Func<object>>();

        public void RegisterSingleton<TInterface, TImplementation>(TImplementation instance) 
            where TImplementation : TInterface
        {
            _services[typeof(TInterface)] = instance;
        }

        public void RegisterSingleton<TInterface>(Func<TInterface> factory)
        {
            _factories[typeof(TInterface)] = () => factory();
        }

        public void RegisterTransient<TInterface, TImplementation>() 
            where TImplementation : TInterface, new()
        {
            _factories[typeof(TInterface)] = () => new TImplementation();
        }

        public void RegisterTransient<TInterface>(Func<TInterface> factory)
        {
            _factories[typeof(TInterface)] = () => factory();
        }

        public T Resolve<T>()
        {
            var type = typeof(T);
            
            if (_services.ContainsKey(type))
            {
                return (T)_services[type];
            }
            
            if (_factories.ContainsKey(type))
            {
                return (T)_factories[type]();
            }
            
            throw new InvalidOperationException($"Service of type {type.Name} is not registered");
        }

        public static ServiceContainer CreateDefault(Solution solution, bool debug = false)
        {
            var container = new ServiceContainer();

            // Register symbol resolvers
            var symbolResolvers = new List<ISymbolResolver>
            {
                new InterfaceSymbolResolver(solution, debug),
                new MediatRSymbolResolver(solution, debug)
            };

            // Register analyzer
            container.RegisterSingleton<ICallGraphAnalyzer>(
                () => new CallGraphAnalyzer(solution, symbolResolvers, debug));

            // Register formatters
            container.RegisterTransient<IOutputFormatter, GraphOutputFormatter>();
            container.RegisterTransient<IOutputFormatter, CodeOutputFormatter>();

            // Register filters
            container.RegisterTransient<ICallTreeFilter, MethodsOnlyFilter>();
            container.RegisterTransient<ICallTreeFilter, HandlerOnlyFilter>();

            // Register service
            container.RegisterSingleton<CallGraphService>(() =>
            {
                var analyzer = container.Resolve<ICallGraphAnalyzer>();
                var formatters = new List<IOutputFormatter>
                {
                    new GraphOutputFormatter(),
                    new CodeOutputFormatter()
                };
                var filters = new List<ICallTreeFilter>
                {
                    new MethodsOnlyFilter(),
                    new HandlerOnlyFilter()
                };

                return new CallGraphService(analyzer, formatters, filters);
            });

            return container;
        }
    }
}