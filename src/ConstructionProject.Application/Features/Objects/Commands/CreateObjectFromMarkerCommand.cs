using System.Text.Json;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Objects.Commands;

public record CreateObjectFromMarkerCommand(
    Guid DrawingFileId,
    int PageNumber,
    string MarkerCoordinates,
    string Name,
    string CreatedBy,
    Guid? CreatedById = null
) : IRequest<ObjectDto>;

public class CreateObjectFromMarkerCommandValidator : AbstractValidator<CreateObjectFromMarkerCommand>
{
    public CreateObjectFromMarkerCommandValidator()
    {
        RuleFor(x => x.DrawingFileId)
            .NotEmpty().WithMessage("DrawingFileId là bắt buộc. Object phải luôn gắn với một bản vẽ cụ thể.");

        RuleFor(x => x.PageNumber)
            .GreaterThanOrEqualTo(1).WithMessage("PageNumber phải lớn hơn hoặc bằng 1.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên Object không được để trống.")
            .MaximumLength(200).WithMessage("Tên Object tối đa 200 ký tự.");

        RuleFor(x => x.MarkerCoordinates)
            .NotEmpty().WithMessage("Toạ độ marker không được để trống.")
            .Must(IsValidMarkerCoordinates).WithMessage("Toạ độ marker không hợp lệ. Phải là JSON chứa x, y, width, height.");
    }

    private static bool IsValidMarkerCoordinates(string coordsJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(coordsJson);
            var root = doc.RootElement;
            return root.ValueKind == JsonValueKind.Object &&
                   (root.TryGetProperty("x", out _) || root.TryGetProperty("X", out _)) &&
                   (root.TryGetProperty("y", out _) || root.TryGetProperty("Y", out _)) &&
                   (root.TryGetProperty("width", out _) || root.TryGetProperty("Width", out _)) &&
                   (root.TryGetProperty("height", out _) || root.TryGetProperty("Height", out _));
        }
        catch
        {
            return false;
        }
    }
}

public class CreateObjectFromMarkerCommandHandler : IRequestHandler<CreateObjectFromMarkerCommand, ObjectDto>
{
    private readonly IApplicationDbContext _context;

    public CreateObjectFromMarkerCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ObjectDto> Handle(CreateObjectFromMarkerCommand request, CancellationToken cancellationToken)
    {
        var drawing = await _context.DrawingFiles
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == request.DrawingFileId, cancellationToken);

        if (drawing == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy bản vẽ với Id = {request.DrawingFileId}. Không thể tạo Object rời rạc.");
        }

        var entity = new ConstructionObject
        {
            Id = Guid.NewGuid(),
            DrawingFileId = request.DrawingFileId,
            PageNumber = request.PageNumber,
            MarkerCoordinates = request.MarkerCoordinates,
            Name = request.Name.Trim(),
            CreatedById = request.CreatedById,
            CreatedBy = string.IsNullOrWhiteSpace(request.CreatedBy) ? "Submitter" : request.CreatedBy.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.Objects.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        return new ObjectDto
        {
            Id = entity.Id,
            DrawingFileId = entity.DrawingFileId,
            DrawingFileName = drawing.FileName,
            PageNumber = entity.PageNumber,
            MarkerCoordinates = entity.MarkerCoordinates,
            Name = entity.Name,
            CreatedBy = entity.CreatedBy,
            CreatedAt = entity.CreatedAt,
            InspectionCount = 0,
            ChecklistCount = 0
        };
    }
}
