using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class ChecklistConfiguration : IEntityTypeConfiguration<Checklist>
{
    public void Configure(EntityTypeBuilder<Checklist> builder)
    {
        builder.ToTable("Checklists");
        builder.HasKey(c => c.Id);

        // Global query filter for Soft Delete (NFR-1)
        builder.HasQueryFilter(c => !c.IsDeleted);

        // Optimistic Concurrency (NFR-2)
        builder.Property(c => c.RowVersion)
            .IsRowVersion();

        builder.Property(c => c.Name)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(c => c.Description)
            .HasMaxLength(1000);

        builder.Property(c => c.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(c => c.WorkflowInstanceId)
            .HasMaxLength(100);

        builder.Property(c => c.RejectReason)
            .HasMaxLength(1000);

        builder.Property(c => c.CreatedBy)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(c => c.ReviewedBy)
            .HasMaxLength(100);

        builder.HasIndex(c => c.ObjectId);
        builder.HasIndex(c => c.CreatedById);
        builder.HasIndex(c => c.ReviewedById);

        builder.HasOne(c => c.Object)
            .WithMany(o => o.Checklists)
            .HasForeignKey(c => c.ObjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Quan hệ User (1) — (n) Checklist (Người tạo - Submitter)
        builder.HasOne(c => c.Creator)
            .WithMany(u => u.CreatedChecklists)
            .HasForeignKey(c => c.CreatedById)
            .OnDelete(DeleteBehavior.Restrict);

        // Quan hệ User (1) — (n) Checklist (Người duyệt - Reviewer)
        builder.HasOne(c => c.Reviewer)
            .WithMany(u => u.ReviewedChecklists)
            .HasForeignKey(c => c.ReviewedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(c => c.Items)
            .WithOne(i => i.Checklist)
            .HasForeignKey(i => i.ChecklistId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.AuditHistories)
            .WithOne(a => a.Checklist)
            .HasForeignKey(a => a.ChecklistId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
