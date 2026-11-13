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
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<ProjectAttachment> ProjectAttachments => Set<ProjectAttachment>();
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
        var (projectIds, drawingIds) = GetDrawingListChanges();
        if (drawingIds.Length > 0)
            projectIds.UnionWith(await DrawingFiles.AsNoTracking().Where(d => drawingIds.Contains(d.Id))
                .Select(d => d.ProjectId).ToListAsync(cancellationToken));
        if (projectIds.Count > 0)
            RotateDrawingListVersions(await Projects.Where(p => projectIds.Contains(p.Id)).ToListAsync(cancellationToken), projectIds);
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
        var (projectIds, drawingIds) = GetDrawingListChanges();
        if (drawingIds.Length > 0)
            projectIds.UnionWith(DrawingFiles.AsNoTracking().Where(d => drawingIds.Contains(d.Id)).Select(d => d.ProjectId));
        if (projectIds.Count > 0)
            RotateDrawingListVersions(Projects.Where(p => projectIds.Contains(p.Id)).ToList(), projectIds);
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

    private (HashSet<Guid> ProjectIds, Guid[] DrawingIds) GetDrawingListChanges()
    {
        var projects = new HashSet<Guid>();
        var drawings = new HashSet<Guid>();
        foreach (var entry in ChangeTracker.Entries<DrawingFile>()
                     .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
        {
            projects.Add(entry.Entity.ProjectId);
            if (entry.State != EntityState.Added)
                projects.Add(entry.OriginalValues.GetValue<Guid>(nameof(DrawingFile.ProjectId)));
        }
        foreach (var entry in ChangeTracker.Entries<ConstructionObject>()
                     .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
        {
            drawings.Add(entry.Entity.DrawingFileId);
            if (entry.State != EntityState.Added)
                drawings.Add(entry.OriginalValues.GetValue<Guid>(nameof(ConstructionObject.DrawingFileId)));
        }
        // New drawings might not exist in SQL yet; changed/deleted parents also need their old project.
        foreach (var entry in ChangeTracker.Entries<DrawingFile>().Where(e => drawings.Contains(e.Entity.Id)))
        {
            projects.Add(entry.Entity.ProjectId);
            if (entry.State != EntityState.Added)
                projects.Add(entry.OriginalValues.GetValue<Guid>(nameof(DrawingFile.ProjectId)));
        }
        return (projects, drawings.ToArray());
    }

    private void RotateDrawingListVersions(IEnumerable<Project> persistedProjects, HashSet<Guid> projectIds)
    {
        foreach (var project in persistedProjects.Concat(ChangeTracker.Entries<Project>()
                     .Where(e => e.State == EntityState.Added && projectIds.Contains(e.Entity.Id))
                     .Select(e => e.Entity)).DistinctBy(p => p.Id))
        {
            if (Entry(project).State != EntityState.Deleted)
                project.DrawingListCacheVersion = Guid.NewGuid();
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
