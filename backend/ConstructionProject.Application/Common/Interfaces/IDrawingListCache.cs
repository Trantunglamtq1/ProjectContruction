using ConstructionProject.Application.DTOs;

namespace ConstructionProject.Application.Common.Interfaces;

/// <summary>Disposable read projection only. The caller must authorize against current SQL data first.</summary>
public interface IDrawingListCache
{
    Task<List<DrawingFileDto>> GetOrCreateAsync(
        Guid projectId, Guid version, string search,
        Func<CancellationToken, Task<List<DrawingFileDto>>> load,
        CancellationToken cancellationToken);
}
