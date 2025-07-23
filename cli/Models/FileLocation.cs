namespace DotNet.Flow.Models
{
    public class FileLocation
    {
        public string FilePath { get; }
        public int StartLine { get; }
        public int EndLine { get; }

        public FileLocation(string filePath, int startLine, int endLine)
        {
            FilePath = filePath;
            StartLine = startLine > 0 ? startLine : 0;
            EndLine = endLine > 0 ? endLine : 0;
        }

        public string FileName => Path.GetFileName(FilePath);

        public string ToLocationString()
        {
            if (string.IsNullOrEmpty(FilePath))
                return string.Empty;

            return StartLine > 0 
                ? $"{FileName}:{StartLine}-{EndLine}"
                : FileName;
        }

        public override string ToString()
        {
            return ToLocationString();
        }

        public override bool Equals(object? obj)
        {
            if (obj is FileLocation other)
            {
                return FilePath == other.FilePath && 
                       StartLine == other.StartLine && 
                       EndLine == other.EndLine;
            }
            return false;
        }

        public override int GetHashCode()
        {
            return HashCode.Combine(FilePath, StartLine, EndLine);
        }
    }
}
