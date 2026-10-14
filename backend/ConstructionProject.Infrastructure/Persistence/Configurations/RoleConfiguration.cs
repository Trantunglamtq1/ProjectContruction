using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("Roles");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Name)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasIndex(r => r.Name)
            .IsUnique();

        builder.Property(r => r.Description)
            .HasMaxLength(255);

        // Seed 4 Role mặc định theo yêu cầu đặc tả
        builder.HasData(
            new Role
            {
                Id = RoleConstants.AdminRoleId,
                Name = RoleConstants.Admin,
                Description = "Quản trị hệ thống: Quản lý danh sách tài khoản và gán vai trò người dùng"
            },
            new Role
            {
                Id = RoleConstants.SubmitterRoleId,
                Name = RoleConstants.Submitter,
                Description = "Kỹ sư hiện trường: Upload bản vẽ, khoanh vùng tạo Object, tạo và submit Form Inspection"
            },
            new Role
            {
                Id = RoleConstants.ReviewerRoleId,
                Name = RoleConstants.Reviewer,
                Description = "Giám sát công trình: Xem xét Inspection, quản lý Checklist, theo dõi tiến độ"
            },
            new Role
            {
                Id = RoleConstants.ApproverRoleId,
                Name = RoleConstants.Approver,
                Description = "Quản lý dự án: Phê duyệt (Approve) hoặc Từ chối (Reject) Inspection"
            }
        );
    }
}
