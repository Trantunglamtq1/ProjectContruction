namespace ConstructionProject.Domain.Constants;

public static class RoleConstants
{
    public const string Admin = "Admin";
    public const string Submitter = "Submitter";
    public const string Reviewer = "Reviewer";
    public const string Approver = "Approver";

    public static readonly Guid AdminRoleId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public static readonly Guid SubmitterRoleId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    public static readonly Guid ReviewerRoleId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    public static readonly Guid ApproverRoleId = Guid.Parse("44444444-4444-4444-4444-444444444444");

    public static readonly Guid DefaultAdminUserId = Guid.Parse("00000000-0000-0000-0000-000000000001");
}
