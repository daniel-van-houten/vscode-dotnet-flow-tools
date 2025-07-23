using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis.MSBuild;
using DotNet.Flow.Abstractions;
using DotNet.Flow.Models;

namespace DotNet.Flow.Services
{
    public class CallGraphService
    {
        private readonly ICallGraphAnalyzer _analyzer;
        private readonly Dictionary<string, IOutputFormatter> _formatters;
        private readonly Dictionary<string, ICallTreeFilter> _filters;

        public CallGraphService(
            ICallGraphAnalyzer analyzer,
            IEnumerable<IOutputFormatter> formatters,
            IEnumerable<ICallTreeFilter> filters)
        {
            _analyzer = analyzer ?? throw new ArgumentNullException(nameof(analyzer));
            _formatters = formatters?.ToDictionary(f => f.Name.ToLower()) 
                         ?? throw new ArgumentNullException(nameof(formatters));
            _filters = filters?.ToDictionary(f => f.Name.ToLower()) 
                      ?? new Dictionary<string, ICallTreeFilter>();
        }

        public async Task AnalyzeAsync(AnalysisOptions options)
        {
            // Initialize MSBuild if not already done
            if (!MSBuildLocator.IsRegistered)
            {
                MSBuildLocator.RegisterDefaults();
            }

            using var workspace = MSBuildWorkspace.Create();
            var solution = await workspace.OpenSolutionAsync(options.SolutionPath);

            // Perform analysis
            var result = await _analyzer.AnalyzeClassMethodAsync(
                options.ClassName, 
                options.MethodName);

            // Apply filters if needed
            if (options.MethodsOnly && _filters.ContainsKey("methodsonly"))
            {
                result = _filters["methodsonly"].Filter(result);
            }

            if (options.HandlersOnly && _filters.ContainsKey("handlersonly"))
            {
                result = _filters["handlersonly"].Filter(result);
            }

            if (result == null)
            {
                Console.WriteLine("No results found after filtering.");
                return;
            }

            // Determine output mode
            var outputToFile = !string.IsNullOrEmpty(options.OutputFile);
            TextWriter outputWriter = null;
            var outputBuilder = new System.Text.StringBuilder();

            try
            {
                if (outputToFile)
                {
                    outputWriter = new StringWriter(outputBuilder);
                }

                // Process each requested formatter
                foreach (var format in options.OutputFormats)
                {
                    var formatterKey = format.ToString().ToLower();
                    if (!_formatters.ContainsKey(formatterKey))
                    {
                        throw new InvalidOperationException($"Output formatter '{format}' not found");
                    }

                    var formatter = _formatters[formatterKey];

                    // Create output context
                    var context = new OutputContext
                    {
                        Solution = solution,
                        ClassName = options.ClassName,
                        MethodName = options.MethodName,
                        MethodsOnly = options.MethodsOnly,
                        HandlersOnly = options.HandlersOnly,
                        OutputWriter = outputWriter ?? Console.Out,
                        OutputPath = null // We'll handle file saving ourselves
                    };

                    // Format and output results
                    await formatter.FormatAsync(result, context);

                    if (outputToFile && options.OutputFormats.IndexOf(format) < options.OutputFormats.Count - 1)
                    {
                        outputBuilder.AppendLine();
                    }
                }

                // Save to file if requested
                if (outputToFile)
                {
                    var outputPath = options.GetOutputFileName();
                    if (!outputPath.EndsWith(".md"))
                    {
                        outputPath += ".md";
                    }
                    await File.WriteAllTextAsync(outputPath, outputBuilder.ToString());
                    Console.WriteLine($"Analysis saved to: {outputPath}");
                }
            }
            finally
            {
                outputWriter?.Dispose();
            }
        }

        public IEnumerable<string> GetAvailableFormatters()
        {
            return _formatters.Keys.OrderBy(k => k);
        }

        public IEnumerable<string> GetAvailableFilters()
        {
            return _filters.Keys.OrderBy(k => k);
        }
    }
}
