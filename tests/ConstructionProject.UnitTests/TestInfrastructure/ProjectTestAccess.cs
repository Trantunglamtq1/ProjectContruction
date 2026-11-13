using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Common.Security;
using ConstructionProject.Domain.Constants;

namespace ConstructionProject.UnitTests.TestInfrastructure;

internal static class ProjectTestAccess
{
    public static IProjectAccessService ForLegacy(IApplicationDbContext db) => new ProjectAccessService(db,new TestAdmin());
    private sealed class TestAdmin : ICurrentUserService
    {
        public Guid? UserId => RoleConstants.DefaultAdminUserId;
        public string? Username => "admin";
        public string? FullName => "Test Admin";
        public string? Email => "admin@test.local";
        public string? Role => RoleConstants.Admin;
        public bool IsAuthenticated => true;
    }
}
