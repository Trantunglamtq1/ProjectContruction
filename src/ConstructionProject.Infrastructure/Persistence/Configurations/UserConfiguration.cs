using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Username)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasIndex(u => u.Username)
            .IsUnique();

        builder.Property(u => u.Email)
            .IsRequired()
            .HasMaxLength(150);

        builder.HasIndex(u => u.Email)
            .IsUnique();

        builder.Property(u => u.FullName)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(u => u.PasswordHash)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(u => u.IsActive)
            .IsRequired()
            .HasDefaultValue(true);

        // RoleId có thể null (tài khoản mới đăng ký chưa có Role)
        builder.HasOne(u => u.Role)
            .WithMany(r => r.Users)
            .HasForeignKey(u => u.RoleId)
            .OnDelete(DeleteBehavior.SetNull);

        // Seed 1 tài khoản Admin mặc định theo đặc tả:
        // Username: admin, Mật khẩu: Admin@123
        builder.HasData(
            new User
            {
                Id = RoleConstants.DefaultAdminUserId,
                Username = "admin",
                Email = "admin@construction.local",
                FullName = "Quản Trị Viên Hệ Thống",
                PasswordHash = "$2a$11$Xj2h81DT5aEkE3uD6miA8ufY8KvoeIKsDogkWOtsL5ibJtTJRGvyC",
                RoleId = RoleConstants.AdminRoleId,
                IsActive = true,
                CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
