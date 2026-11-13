using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Code).HasMaxLength(50).IsRequired();
        builder.Property(p => p.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(p => p.Code).IsUnique();
        builder.HasData(new Project
        {
            Id = Project.LegacyId, Code = "LEGACY", Name = "Dữ liệu chuyển đổi",
            CreatedAt = new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc)
        });
        builder.HasMany<DrawingFile>().WithOne(d => d.Project).HasForeignKey(d => d.ProjectId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany<Notification>().WithOne(n => n.Project).HasForeignKey(n => n.ProjectId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProjectMemberConfiguration : IEntityTypeConfiguration<ProjectMember>
{
    public void Configure(EntityTypeBuilder<ProjectMember> builder)
    {
        builder.HasKey(m => new { m.ProjectId, m.UserId });
        builder.HasIndex(m => new { m.UserId, m.ProjectId });
        builder.HasOne(m => m.Project).WithMany(p => p.Members).HasForeignKey(m => m.ProjectId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(m => m.User).WithMany().HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(m => m.AssignedById).OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProjectAttachmentConfiguration : IEntityTypeConfiguration<ProjectAttachment>
{
    public void Configure(EntityTypeBuilder<ProjectAttachment> builder)
    {
        builder.HasKey(a => a.Id);
        builder.HasIndex(a => a.StoredFileName).IsUnique();
        builder.Property(a => a.StoredFileName).HasMaxLength(512).IsRequired();
        builder.Property(a => a.OriginalName).HasMaxLength(512).IsRequired();
        builder.Property(a => a.ContentType).HasMaxLength(100).IsRequired();
        builder.HasOne(a => a.Project).WithMany().HasForeignKey(a => a.ProjectId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(a => a.UploadedById).OnDelete(DeleteBehavior.Restrict);
    }
}
