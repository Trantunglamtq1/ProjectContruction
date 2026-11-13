using ConstructionProject.Application.Common.Security;

namespace ConstructionProject.Application.Common.Interfaces;

public interface IProjectAccessService
{
    IQueryable<Guid> AccessibleProjectIds { get; }
    Task DemandIdentityAsync(CancellationToken cancellationToken = default);
    Task DemandAdminAsync(CancellationToken cancellationToken = default);
    Task DemandProjectAsync(Guid projectId, CancellationToken cancellationToken = default);
    Task<Guid> DemandAsync(ProjectResource resource, CancellationToken cancellationToken = default);
}
