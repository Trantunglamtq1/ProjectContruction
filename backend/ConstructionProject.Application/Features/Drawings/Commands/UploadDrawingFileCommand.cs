using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using FluentValidation;
using MediatR;

namespace ConstructionProject.Application.Features.Drawings.Commands;

public record UploadDrawingFileCommand(
    Stream FileStream,
    string FileName,
    string ContentType,
    long FileSize,
    string UploadedBy,
    Guid? UploadedById = null
) : IRequest<DrawingFileDto>;

public class UploadDrawingFileCommandValidator : AbstractValidator<UploadDrawingFileCommand>
{
    public UploadDrawingFileCommandValidator()
    {
        RuleFor(x => x.FileName)
            .NotEmpty().WithMessage("Tên file không được để trống.")
            .Must(x => Path.GetExtension(x).Equals(".pdf", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Hệ thống chỉ chấp nhận upload bản vẽ định dạng PDF.");

        RuleFor(x => x.FileSize)
            .GreaterThan(0).WithMessage("File không được rỗng.")
            .LessThanOrEqualTo(100 * 1024 * 1024).WithMessage("Kích thước file không được vượt quá 100MB.");

        RuleFor(x => x.UploadedBy)
            .NotEmpty().WithMessage("Người upload không được để trống.");
    }
}

public class UploadDrawingFileCommandHandler : IRequestHandler<UploadDrawingFileCommand, DrawingFileDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IFileStorageService _fileStorage;

    public UploadDrawingFileCommandHandler(
        IApplicationDbContext context, 
        IFileStorageService fileStorage)
    {
        _context = context;
        _fileStorage = fileStorage;
    }

    public async Task<DrawingFileDto> Handle(UploadDrawingFileCommand request, CancellationToken cancellationToken)
    {
        var (fileUrl, storedFileName, size) = await _fileStorage.SaveFileAsync(
            request.FileStream,
            request.FileName,
            request.ContentType,
            cancellationToken);

        var entity = new DrawingFile
        {
            Id = Guid.NewGuid(),
            FileName = request.FileName,
            StoredFileName = storedFileName,
            FileType = "pdf",
            FileUrl = fileUrl,
            FileSizeBytes = size,
            UploadedById = request.UploadedById,
            UploadedBy = string.IsNullOrWhiteSpace(request.UploadedBy) ? "Submitter" : request.UploadedBy,
            UploadedAt = DateTime.UtcNow
        };

        _context.DrawingFiles.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        return new DrawingFileDto
        {
            Id = entity.Id,
            FileName = entity.FileName,
            FileType = entity.FileType,
            FileUrl = entity.FileUrl,
            FileSizeBytes = entity.FileSizeBytes,
            UploadedBy = entity.UploadedBy,
            UploadedAt = entity.UploadedAt,
            ObjectCount = 0
        };
    }
}
