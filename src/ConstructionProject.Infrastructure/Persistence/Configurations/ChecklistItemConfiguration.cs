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

        builder.Property(i => i.Name)
            .IsRequired()
            .HasMaxLength(255);

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
