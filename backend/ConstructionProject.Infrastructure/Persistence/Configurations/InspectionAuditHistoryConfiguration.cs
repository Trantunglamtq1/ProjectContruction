using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class InspectionAuditHistoryConfiguration : IEntityTypeConfiguration<InspectionAuditHistory>
{
    public void Configure(EntityTypeBuilder<InspectionAuditHistory> builder)
    {
        builder.ToTable("InspectionAuditHistories");
        builder.HasKey(h => h.Id);

        builder.Property(h => h.Action)
            .IsRequired()
            .HasMaxLength(50);

        builder.Property(h => h.FromStatus)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(h => h.ToStatus)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(h => h.ActorName)
            .HasMaxLength(150);

        builder.Property(h => h.ActorRole)
            .HasMaxLength(50);

        builder.Property(h => h.Comment)
            .HasMaxLength(1000);

        builder.HasIndex(h => h.InspectionId);
        builder.HasIndex(h => h.CreatedAt);

        builder.HasOne(h => h.Inspection)
            .WithMany(i => i.AuditHistories)
            .HasForeignKey(h => h.InspectionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
