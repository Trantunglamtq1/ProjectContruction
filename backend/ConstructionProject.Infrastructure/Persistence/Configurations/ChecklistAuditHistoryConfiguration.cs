using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class ChecklistAuditHistoryConfiguration : IEntityTypeConfiguration<ChecklistAuditHistory>
{
    public void Configure(EntityTypeBuilder<ChecklistAuditHistory> builder)
    {
        builder.ToTable("ChecklistAuditHistories");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.FromStatus)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(a => a.ToStatus)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(a => a.Action)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(a => a.ActorName)
            .HasMaxLength(100);

        builder.Property(a => a.ActorRole)
            .HasMaxLength(50);

        builder.Property(a => a.Comment)
            .HasMaxLength(1000);

        builder.Property(a => a.DetailsJson)
            .HasColumnType("nvarchar(max)");

        builder.HasIndex(a => a.ChecklistId);
        builder.HasIndex(a => a.CreatedAt);

        builder.HasOne(a => a.Checklist)
            .WithMany(c => c.AuditHistories)
            .HasForeignKey(a => a.ChecklistId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
