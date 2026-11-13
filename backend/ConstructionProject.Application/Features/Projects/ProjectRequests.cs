using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Common.Security;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace ConstructionProject.Application.Features.Projects;

public record ProjectDto(Guid Id,string Code,string Name,DateTime CreatedAt);
public record ProjectMemberDto(Guid UserId,string Username,string FullName,string Email,string? RoleName,DateTime AssignedAt);
public record GetProjectsQuery : IRequest<List<ProjectDto>>;
public record GetProjectQuery(Guid Id) : IRequest<ProjectDto>;
public record CreateProjectCommand(string Code,string Name) : IRequest<ProjectDto>;
public record GetProjectMembersQuery(Guid ProjectId) : IRequest<List<ProjectMemberDto>>;
public record AssignProjectMemberCommand(Guid ProjectId,Guid UserId) : IRequest<ProjectMemberDto>;
public record RevokeProjectMemberCommand(Guid ProjectId,Guid UserId) : IRequest<Unit>;

public class CreateProjectValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectValidator()
    {
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50).Must(x => !string.IsNullOrWhiteSpace(x)).WithMessage("Vui lòng nhập mã dự án.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).Must(x => !string.IsNullOrWhiteSpace(x)).WithMessage("Vui lòng nhập tên dự án.");
    }
}

public sealed class ProjectHandlers(IApplicationDbContext db,IProjectAccessService access,ICurrentUserService current,IProjectAccessEvents events) :
    IRequestHandler<GetProjectsQuery,List<ProjectDto>>, IRequestHandler<GetProjectQuery,ProjectDto>,
    IRequestHandler<CreateProjectCommand,ProjectDto>, IRequestHandler<GetProjectMembersQuery,List<ProjectMemberDto>>,
    IRequestHandler<AssignProjectMemberCommand,ProjectMemberDto>, IRequestHandler<RevokeProjectMemberCommand,Unit>
{
    public Task<List<ProjectDto>> Handle(GetProjectsQuery request,CancellationToken ct) => db.Projects.AsNoTracking()
        .Where(p => access.AccessibleProjectIds.Contains(p.Id)).OrderBy(p => p.Name)
        .Select(p => new ProjectDto(p.Id,p.Code,p.Name,p.CreatedAt)).ToListAsync(ct);

    public async Task<ProjectDto> Handle(GetProjectQuery request,CancellationToken ct)
    {
        await access.DemandAsync(new(ProjectResourceKind.Project,request.Id),ct);
        return await db.Projects.Where(p => p.Id == request.Id).Select(p => new ProjectDto(p.Id,p.Code,p.Name,p.CreatedAt)).SingleAsync(ct);
    }

    public async Task<ProjectDto> Handle(CreateProjectCommand request,CancellationToken ct)
    {
        await access.DemandAdminAsync(ct);
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.Projects.AnyAsync(p => p.Code == code,ct)) throw new InvalidOperationException("Mã dự án đã tồn tại.");
        var entity = new Project { Code = code, Name = request.Name.Trim() };
        db.Projects.Add(entity); await db.SaveChangesAsync(ct);
        return new(entity.Id,entity.Code,entity.Name,entity.CreatedAt);
    }

    public async Task<List<ProjectMemberDto>> Handle(GetProjectMembersQuery request,CancellationToken ct)
    {
        await DemandManagedProject(request.ProjectId,ct);
        return await Members(request.ProjectId).OrderBy(m => m.User.Username).Select(MemberDto).ToListAsync(ct);
    }

    public async Task<ProjectMemberDto> Handle(AssignProjectMemberCommand request,CancellationToken ct)
    {
        await DemandManagedProject(request.ProjectId,ct);
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == request.UserId,ct)
            ?? throw new KeyNotFoundException("Không tìm thấy người dùng.");
        if (!user.IsActive || !(user.RoleId == RoleConstants.SubmitterRoleId || user.RoleId == RoleConstants.ReviewerRoleId || user.RoleId == RoleConstants.ApproverRoleId))
            throw new InvalidOperationException("Chỉ phân công người dùng nghiệp vụ đang hoạt động.");
        if (!await db.ProjectMembers.AnyAsync(m => m.ProjectId == request.ProjectId && m.UserId == request.UserId,ct))
        {
            db.ProjectMembers.Add(new ProjectMember { ProjectId = request.ProjectId, UserId = request.UserId, AssignedById = current.UserId });
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException)
            {
                if (!await db.ProjectMembers.AsNoTracking().AnyAsync(m => m.ProjectId == request.ProjectId && m.UserId == request.UserId,ct)) throw;
            }
        }
        await events.MembershipChangedAsync(request.UserId,request.ProjectId,ct);
        return await Members(request.ProjectId).Where(m => m.UserId == request.UserId).Select(MemberDto).SingleAsync(ct);
    }

    public async Task<Unit> Handle(RevokeProjectMemberCommand request,CancellationToken ct)
    {
        await DemandManagedProject(request.ProjectId,ct);
        var member = await db.ProjectMembers.SingleOrDefaultAsync(m => m.ProjectId == request.ProjectId && m.UserId == request.UserId,ct);
        if (member != null)
        {
            db.ProjectMembers.Remove(member);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException)
            {
                if (await db.ProjectMembers.AsNoTracking().AnyAsync(m => m.ProjectId == request.ProjectId && m.UserId == request.UserId,ct)) throw;
            }
        }
        await events.MembershipChangedAsync(request.UserId,request.ProjectId,ct);
        return Unit.Value;
    }

    private async Task DemandManagedProject(Guid id,CancellationToken ct)
    {
        await access.DemandAdminAsync(ct);
        if (!await db.Projects.AnyAsync(p => p.Id == id,ct)) throw new KeyNotFoundException("Không tìm thấy dự án.");
    }
    private IQueryable<ProjectMember> Members(Guid projectId) => db.ProjectMembers.AsNoTracking().Where(m => m.ProjectId == projectId);
    private static readonly Expression<Func<ProjectMember,ProjectMemberDto>> MemberDto = m =>
        new ProjectMemberDto(m.UserId,m.User.Username,m.User.FullName,m.User.Email,m.User.Role == null ? null : m.User.Role.Name,m.AssignedAt);
}
