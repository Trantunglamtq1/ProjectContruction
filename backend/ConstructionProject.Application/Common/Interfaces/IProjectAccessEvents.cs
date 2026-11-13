namespace ConstructionProject.Application.Common.Interfaces;

public interface IProjectAccessEvents
{
    Task MembershipChangedAsync(Guid userId,Guid projectId,CancellationToken cancellationToken = default);
}
