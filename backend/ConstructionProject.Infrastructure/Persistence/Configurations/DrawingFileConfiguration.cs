using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ConstructionProject.Infrastructure.Persistence.Configurations;

public class DrawingFileConfiguration : IEntityTypeConfiguration<DrawingFile>
{
    public void Configure(EntityTypeBuilder<DrawingFile> builder)
    {
        builder.ToTable("DrawingFiles");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.FileName)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(d => d.StoredFileName)
            .IsRequired()
            .HasMaxLength(300);

        builder.Property(d => d.FileType)
            .IsRequired()
            .HasMaxLength(20);

        builder.Property(d => d.FileUrl)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(d => d.UploadedBy)
            .IsRequired()
            .HasMaxLength(100);

        // Quan hệ User (1) — (n) DrawingFile (qua UploadedById)
        builder.HasOne(d => d.Uploader)
            .WithMany(u => u.UploadedDrawingFiles)
            .HasForeignKey(d => d.UploadedById)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(d => d.Objects)
            .WithOne(o => o.DrawingFile)
            .HasForeignKey(o => o.DrawingFileId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
