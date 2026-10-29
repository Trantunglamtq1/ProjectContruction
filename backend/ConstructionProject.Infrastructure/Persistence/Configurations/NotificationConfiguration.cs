using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications");
        builder.HasKey(n => n.Id);

        builder.Property(n => n.Title)
            .IsRequired()
            .HasMaxLength(250);

        builder.Property(n => n.Content)
            .IsRequired()
            .HasMaxLength(2000);

        builder.Property(n => n.Type)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(n => n.RoleName)
            .HasMaxLength(50);

        builder.Property(n => n.TargetUrl)
            .HasMaxLength(500);

        builder.Property(n => n.ReferenceId)
            .HasMaxLength(100);

        builder.Property(n => n.ReferenceType)
            .HasMaxLength(50);

        builder.HasIndex(n => n.UserId);
        builder.HasIndex(n => n.RoleName);
        builder.HasIndex(n => n.CreatedAt);
        builder.HasIndex(n => n.IsRead);
    }
}
