using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Common.Security;
using ConstructionProject.Domain.Constants;

namespace ConstructionProject.IntegrationTests;

internal static class ProjectTestAccess
{
    public static IProjectAccessService ForAdmin(IApplicationDbContext db) => new ProjectAccessService(db,new SeededAdmin());
    public static ICurrentUserService AdminIdentity() => new SeededAdmin();
    public static IProjectAccessService ForSubmitter(IApplicationDbContext db,Guid id) => new ProjectAccessService(db,new Submitter(id));
    private sealed class Submitter(Guid id) : ICurrentUserService
    {
        public Guid? UserId => id;
        public string? Username => "submitter";
        public string? FullName => "Test Submitter";
        public string? Email => "submitter@test.local";
        public string? Role => RoleConstants.Submitter;
        public bool IsAuthenticated => true;
    }
    private sealed class SeededAdmin : ICurrentUserService
    {
        public Guid? UserId => RoleConstants.DefaultAdminUserId;
        public string? Username => "admin";
        public string? FullName => "Test Admin";
        public string? Email => "admin@test.local";
        public string? Role => RoleConstants.Admin;
        public bool IsAuthenticated => true;
    }
}
