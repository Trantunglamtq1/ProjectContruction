using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Constants;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Common.Security;

public enum ProjectResourceKind { Project, Drawing, Object, Checklist, ChecklistItem, Inspection }
public readonly record struct ProjectResource(ProjectResourceKind Kind, Guid Id);
public sealed class ProjectAccessDeniedException(string message = "Bạn không có quyền truy cập dự án này.") : Exception(message);

public sealed class ProjectAccessService(IApplicationDbContext db, ICurrentUserService current) : IProjectAccessService
{
    private Guid UserId => current.IsAuthenticated ? current.UserId ?? Guid.Empty : Guid.Empty;
    private Guid? ClaimedRoleId => current.Role switch
    {
        RoleConstants.Admin => RoleConstants.AdminRoleId,
        RoleConstants.Submitter => RoleConstants.SubmitterRoleId,
        RoleConstants.Reviewer => RoleConstants.ReviewerRoleId,
        RoleConstants.Approver => RoleConstants.ApproverRoleId,
        _ => null
    };

    // Intentionally evaluated by the database, on each request/query. No cached memberships.
    public IQueryable<Guid> AccessibleProjectIds
    {
        get
        {
            var id = UserId; var role = ClaimedRoleId;
            return db.Projects.Where(p => db.Users.Any(u => u.Id == id && u.IsActive && role != null && u.RoleId == role &&
                (u.RoleId == RoleConstants.AdminRoleId || db.ProjectMembers.Any(m => m.ProjectId == p.Id && m.UserId == id))))
                .Select(p => p.Id);
        }
    }

    public async Task DemandIdentityAsync(CancellationToken cancellationToken = default)
    {
        var id = UserId;
        if (id == Guid.Empty || !await db.Users.AsNoTracking().AnyAsync(u => u.Id == id && u.IsActive, cancellationToken))
            throw new ProjectAccessDeniedException();
    }

    public async Task DemandAdminAsync(CancellationToken cancellationToken = default)
    {
        if (current.Role != RoleConstants.Admin || !await db.Users.AsNoTracking().AnyAsync(u => u.Id == UserId && u.IsActive && u.RoleId == RoleConstants.AdminRoleId, cancellationToken))
            throw new ProjectAccessDeniedException("Bạn không có quyền quản trị dự án.");
    }

    public async Task DemandProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        if (projectId == Guid.Empty || !await AccessibleProjectIds.ContainsAsync(projectId, cancellationToken))
            throw new ProjectAccessDeniedException();
    }

    public async Task<Guid> DemandAsync(ProjectResource resource, CancellationToken cancellationToken = default)
    {
        Guid? project = resource.Kind switch
        {
            ProjectResourceKind.Project => await db.Projects.Where(p => p.Id == resource.Id).Select(p => (Guid?)p.Id).SingleOrDefaultAsync(cancellationToken),
            ProjectResourceKind.Drawing => await db.DrawingFiles.Where(d => d.Id == resource.Id).Select(d => (Guid?)d.ProjectId).SingleOrDefaultAsync(cancellationToken),
            ProjectResourceKind.Object => await db.Objects.Where(o => o.Id == resource.Id).Select(o => (Guid?)o.DrawingFile!.ProjectId).SingleOrDefaultAsync(cancellationToken),
            ProjectResourceKind.Checklist => await db.Checklists.Where(c => c.Id == resource.Id).Select(c => (Guid?)c.Object!.DrawingFile!.ProjectId).SingleOrDefaultAsync(cancellationToken),
            ProjectResourceKind.ChecklistItem => await db.ChecklistItems.Where(i => i.Id == resource.Id).Select(i => (Guid?)i.Checklist!.Object!.DrawingFile!.ProjectId).SingleOrDefaultAsync(cancellationToken),
            ProjectResourceKind.Inspection => await db.FormInspections.Where(i => i.Id == resource.Id).Select(i => (Guid?)i.Object!.DrawingFile!.ProjectId).SingleOrDefaultAsync(cancellationToken),
            _ => throw new ProjectAccessDeniedException()
        };
        if (!project.HasValue) throw new KeyNotFoundException("Không tìm thấy tài nguyên.");
        await DemandProjectAsync(project.Value, cancellationToken);
        return project.Value;
    }
}
