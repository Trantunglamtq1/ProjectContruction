using System.Reflection;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<DrawingFile> DrawingFiles => Set<DrawingFile>();
    public DbSet<ConstructionObject> Objects => Set<ConstructionObject>();
    public DbSet<FormInspection> FormInspections => Set<FormInspection>();
    public DbSet<InspectionAuditHistory> InspectionAuditHistories => Set<InspectionAuditHistory>();
    public DbSet<InspectionWorkflowOperation> InspectionWorkflowOperations => Set<InspectionWorkflowOperation>();
    public DbSet<Checklist> Checklists => Set<Checklist>();
    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();
    public DbSet<ChecklistAuditHistory> ChecklistAuditHistories => Set<ChecklistAuditHistory>();
    public DbSet<ChecklistWorkflowOperation> ChecklistWorkflowOperations => Set<ChecklistWorkflowOperation>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Notification> Notifications => Set<Notification>();

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) =>
        SaveChangesAsync(true, cancellationToken);

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ChangeTracker.DetectChanges();
        var checklistIds = ChangeTracker.Entries<ChecklistItem>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(entry => entry.Entity.ChecklistId)
            .Distinct().ToArray();

        foreach (var checklistId in checklistIds)
        {
            var checklist = ChangeTracker.Entries<Checklist>()
                .FirstOrDefault(entry => entry.Entity.Id == checklistId)?.Entity
                ?? await Checklists.SingleAsync(c => c.Id == checklistId, cancellationToken);
            if (Entry(checklist).State != EntityState.Added)
                checklist.ItemsRevision = checked(checklist.ItemsRevision + 1);
        }

        return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    public override int SaveChanges() => SaveChanges(true);

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        ChangeTracker.DetectChanges();
        var checklistIds = ChangeTracker.Entries<ChecklistItem>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .Select(entry => entry.Entity.ChecklistId)
            .Distinct().ToArray();

        foreach (var checklistId in checklistIds)
        {
            var checklist = ChangeTracker.Entries<Checklist>()
                .FirstOrDefault(entry => entry.Entity.Id == checklistId)?.Entity
                ?? Checklists.Single(c => c.Id == checklistId);
            if (Entry(checklist).State != EntityState.Added)
                checklist.ItemsRevision = checked(checklist.ItemsRevision + 1);
        }

        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
