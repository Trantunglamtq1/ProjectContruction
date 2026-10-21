using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class ChecklistItemConfiguration : IEntityTypeConfiguration<ChecklistItem>
{
    public void Configure(EntityTypeBuilder<ChecklistItem> builder)
    {
        builder.ToTable("ChecklistItems");
        builder.HasKey(i => i.Id);

        // Global query filter for Soft Delete (NFR-1)
        builder.HasQueryFilter(i => !i.IsDeleted);

        // Optimistic Concurrency (NFR-2)
        builder.Property(i => i.RowVersion)
            .IsRowVersion();

        builder.Property(i => i.Name)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(i => i.OrderIndex)
            .IsRequired()
            .HasDefaultValue(0);

        builder.Property(i => i.FormSchemaJson)
            .IsRequired()
            .HasColumnType("nvarchar(max)");

        builder.Property(i => i.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.HasOne(i => i.LinkedInspection)
            .WithMany(f => f.LinkedChecklistItems)
            .HasForeignKey(i => i.LinkedInspectionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => i.ChecklistId);
        builder.HasIndex(i => i.LinkedInspectionId);
    }
}
