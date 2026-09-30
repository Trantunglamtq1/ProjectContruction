using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class ConstructionObjectConfiguration : IEntityTypeConfiguration<ConstructionObject>
{
    public void Configure(EntityTypeBuilder<ConstructionObject> builder)
    {
        builder.ToTable("Objects");
        builder.HasKey(o => o.Id);

        builder.Property(o => o.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(o => o.PageNumber)
            .IsRequired();

        builder.Property(o => o.MarkerCoordinates)
            .IsRequired();

        builder.Property(o => o.CreatedBy)
            .IsRequired()
            .HasMaxLength(100);

        builder.HasIndex(o => o.DrawingFileId);
        builder.HasIndex(o => o.CreatedById);

        // Quan hệ User (1) — (n) ConstructionObject (qua CreatedById)
        builder.HasOne(o => o.Creator)
            .WithMany(u => u.CreatedObjects)
            .HasForeignKey(o => o.CreatedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(o => o.FormInspections)
            .WithOne(f => f.Object)
            .HasForeignKey(f => f.ObjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(o => o.Checklists)
            .WithOne(c => c.Object)
            .HasForeignKey(c => c.ObjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
