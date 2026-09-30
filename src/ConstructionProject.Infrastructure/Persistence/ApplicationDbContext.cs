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
    public DbSet<Checklist> Checklists => Set<Checklist>();
    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
