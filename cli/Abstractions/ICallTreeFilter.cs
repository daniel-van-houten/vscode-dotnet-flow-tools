using DotNet.Flow.Models;

namespace DotNet.Flow.Abstractions
{
    public interface ICallTreeFilter
    {
        CallTreeNode Filter(CallTreeNode node);
        string Name { get; }
        string Description { get; }
    }
}