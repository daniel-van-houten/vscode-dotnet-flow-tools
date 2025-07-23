using CommandLine;
using Microsoft.Build.Locator;
using Microsoft.CodeAnalysis.MSBuild;
using DotNet.Flow.Models;
using DotNet.Flow.Services;

namespace DotNet.Flow
{
    public class Options
    {
        [Option('s', "solution", Required = true, HelpText = "Path to the .NET solution file")]
        public string SolutionPath { get; set; }

        [Option('c', "class", Required = true, HelpText = "Name of the class to analyze")]
        public string ClassName { get; set; }

        [Option('m', "method", Required = true, HelpText = "Name of the method to analyze")]
        public string MethodName { get; set; }

        [Option('v', "view", Required = false, HelpText = "Output view format(s): graph,files,code (comma-separated)", Default = "graph")]
        public string View { get; set; }

        [Option("methods-only", Required = false, HelpText = "Filter results to only show classes with methods (excludes DTOs and classes with only constructors)", Default = false)]
        public bool MethodsOnly { get; set; }

        [Option("handlers-only", Required = false, HelpText = "Filter results to only show handler classes (MediatR handlers or classes with Handler suffix)", Default = false)]
        public bool HandlersOnly { get; set; }

        [Option('o', "output", Required = false, HelpText = "Output file path (creates markdown file). If not specified, outputs to console")]
        public string OutputFile { get; set; }

        [Option('d', "debug", Required = false, HelpText = "Enable debug output to show detailed analysis information", Default = false)]
        public bool Debug { get; set; }
    }

    class Program
    {
        static async Task<int> Main(string[] args)
        {
            var parser = new Parser(config => config.HelpWriter = Console.Error);
            var result = parser.ParseArguments<Options>(args);
            
            return await result.MapResult(
                async (Options opts) => await RunAsync(opts),
                errs => Task.FromResult(1)
            );
        }

        static async Task<int> RunAsync(Options opts)
        {
            try
            {
                // Initialize MSBuild
                MSBuildLocator.RegisterDefaults();

                // Parse view formats
                var viewFormats = ParseViewFormats(opts.View);

                // Create analysis options
                var analysisOptions = new AnalysisOptions(
                    opts.SolutionPath,
                    opts.ClassName,
                    opts.MethodName,
                    viewFormats,
                    opts.MethodsOnly,
                    opts.HandlersOnly,
                    opts.OutputFile,
                    opts.Debug
                );

                // Open solution and create service container
                using var workspace = MSBuildWorkspace.Create();
                var solution = await workspace.OpenSolutionAsync(opts.SolutionPath);
                var container = ServiceContainer.CreateDefault(solution, opts.Debug);

                // Get the service and perform analysis
                var service = container.Resolve<CallGraphService>();
                await service.AnalyzeAsync(analysisOptions);

                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error: {ex.Message}");
                return 1;
            }
        }

        static List<OutputFormat> ParseViewFormats(string viewString)
        {
            var formats = new List<OutputFormat>();
            var views = viewString.ToLower().Split(',', StringSplitOptions.RemoveEmptyEntries);

            foreach (var view in views)
            {
                var trimmedView = view.Trim();
                switch (trimmedView)
                {
                    case "graph":
                        formats.Add(OutputFormat.Graph);
                        break;
                    case "code":
                        formats.Add(OutputFormat.Code);
                        break;
                    default:
                        throw new ArgumentException($"Invalid view format: {trimmedView}. Valid options are: graph, code");
                }
            }

            return formats.Count > 0 ? formats : new List<OutputFormat> { OutputFormat.Graph };
        }
    }
}
