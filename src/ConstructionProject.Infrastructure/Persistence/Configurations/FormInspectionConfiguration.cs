using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class FormInspectionConfiguration : IEntityTypeConfiguration<FormInspection>
{
    public void Configure(EntityTypeBuilder<FormInspection> builder)
    {
        builder.ToTable("FormInspections");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.FormSchemaId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(f => f.FormDataJson)
            .IsRequired();

        builder.Property(f => f.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(f => f.RejectReason)
            .HasMaxLength(1000);

        builder.HasIndex(f => f.ObjectId);
        builder.HasIndex(f => f.Status);
        builder.HasIndex(f => f.SubmittedById);
        builder.HasIndex(f => f.ReviewedById);
        builder.HasIndex(f => f.ApprovedById);

        builder.HasOne(f => f.Object)
            .WithMany(o => o.FormInspections)
            .HasForeignKey(f => f.ObjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Quan hệ User (1) — (n) FormInspection qua SubmittedById
        builder.HasOne(f => f.Submitter)
            .WithMany(u => u.SubmittedInspections)
            .HasForeignKey(f => f.SubmittedById)
            .OnDelete(DeleteBehavior.Restrict);

        // Quan hệ User (1) — (n) FormInspection qua ReviewedById
        builder.HasOne(f => f.Reviewer)
            .WithMany(u => u.ReviewedInspections)
            .HasForeignKey(f => f.ReviewedById)
            .OnDelete(DeleteBehavior.Restrict);

        // Quan hệ User (1) — (n) FormInspection qua ApprovedById
        builder.HasOne(f => f.Approver)
            .WithMany(u => u.ApprovedInspections)
            .HasForeignKey(f => f.ApprovedById)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
