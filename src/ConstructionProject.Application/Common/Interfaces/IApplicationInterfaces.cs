using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<DrawingFile> DrawingFiles { get; }
    DbSet<ConstructionObject> Objects { get; }
    DbSet<FormInspection> FormInspections { get; }
    DbSet<Checklist> Checklists { get; }
    DbSet<ChecklistItem> ChecklistItems { get; }
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IFileStorageService
{
    Task<(string fileUrl, string storedFileName, long size)> SaveFileAsync(
        Stream fileStream, 
        string originalFileName, 
        string contentType, 
        CancellationToken cancellationToken = default);

    Task<(Stream stream, string contentType, string fileName)?> GetFileAsync(
        string storedFileName, 
        CancellationToken cancellationToken = default);

    Task<bool> DeleteFileAsync(string storedFileName, CancellationToken cancellationToken = default);
}
