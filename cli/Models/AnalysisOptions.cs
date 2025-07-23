namespace DotNet.Flow.Models
{
    public class AnalysisOptions
    {
        public string SolutionPath { get; }
        public string ClassName { get; }
        public string MethodName { get; }
        public List<OutputFormat> OutputFormats { get; }
        public bool MethodsOnly { get; }
        public bool HandlersOnly { get; }
        public string? OutputFile { get; }
        public bool Debug { get; }

        public AnalysisOptions(
            string solutionPath, 
            string className, 
            string methodName, 
            List<OutputFormat> outputFormats, 
            bool methodsOnly = false,
            bool handlersOnly = false,
            string? outputFile = null,
            bool debug = false)
        {
            SolutionPath = solutionPath ?? throw new ArgumentNullException(nameof(solutionPath));
            ClassName = className ?? throw new ArgumentNullException(nameof(className));
            MethodName = methodName ?? throw new ArgumentNullException(nameof(methodName));
            OutputFormats = outputFormats ?? new List<OutputFormat> { OutputFormat.Graph };
            MethodsOnly = methodsOnly;
            HandlersOnly = handlersOnly;
            OutputFile = outputFile;
            Debug = debug;
        }

        public string GetOutputFileName()
        {
            if (!string.IsNullOrEmpty(OutputFile))
            {
                return OutputFile;
            }
            
            var formats = string.Join("_", OutputFormats.Select(f => f.ToString().ToLower()));
            return $"{ClassName}_{MethodName}_{formats}";
        }
    }

    public enum OutputFormat
    {
        Graph,
        Code
    }
}