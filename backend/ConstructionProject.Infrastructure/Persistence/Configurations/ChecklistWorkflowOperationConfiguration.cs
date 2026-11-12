using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public sealed class ChecklistWorkflowOperationConfiguration : IEntityTypeConfiguration<ChecklistWorkflowOperation>
{
    public void Configure(EntityTypeBuilder<ChecklistWorkflowOperation> builder)
    {
        builder.ToTable("ChecklistWorkflowOperations");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.InstanceId).HasMaxLength(100).IsRequired();
        builder.Property(x => x.PreviousInstanceId).HasMaxLength(100);
        builder.Property(x => x.Action).HasMaxLength(32).IsRequired();
        builder.Property(x => x.ActorName).HasMaxLength(200);
        builder.Property(x => x.Comment).HasMaxLength(1000);
        builder.Property(x => x.LastError).HasMaxLength(1000);
        builder.HasOne(x => x.Checklist).WithMany(x => x.WorkflowOperations).HasForeignKey(x => x.ChecklistId).OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => x.ChecklistId).IsUnique().HasFilter("[CompletedAt] IS NULL");
        builder.HasIndex(x => new { x.CompletedAt, x.NextAttemptAt });
    }
}
