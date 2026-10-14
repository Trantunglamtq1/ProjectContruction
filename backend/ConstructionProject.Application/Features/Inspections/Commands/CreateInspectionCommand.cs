using System.Text.Json;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record CreateInspectionCommand(
    Guid ObjectId,
    string? FormSchemaId = null,
    string? FormDataJson = null,
    Guid? SubmitterId = null,
    string? SubmitterName = null
) : IRequest<InspectionDto>;

public class CreateInspectionCommandValidator : AbstractValidator<CreateInspectionCommand>
{
    public CreateInspectionCommandValidator()
    {
        RuleFor(x => x.ObjectId)
            .NotEmpty().WithMessage("ObjectId là bắt buộc. Form Inspection phải luôn gắn với một Object đã được xác định từ bản vẽ.");

        RuleFor(x => x.FormSchemaId)
            .MaximumLength(100).WithMessage("FormSchemaId tối đa 100 ký tự.");

        RuleFor(x => x.FormDataJson)
            .Must(BeValidJson).When(x => !string.IsNullOrWhiteSpace(x.FormDataJson))
            .WithMessage("FormDataJson phải là định dạng JSON hợp lệ.");
    }

    private static bool BeValidJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return true;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object;
        }
        catch
        {
            return false;
        }
    }
}

public class CreateInspectionCommandHandler : IRequestHandler<CreateInspectionCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;

    public CreateInspectionCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<InspectionDto> Handle(CreateInspectionCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra Object tồn tại kèm DrawingFile
        var constructionObject = await _context.Objects
            .Include(o => o.DrawingFile)
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == request.ObjectId, cancellationToken);

        if (constructionObject == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy Object với Id = {request.ObjectId}. Không thể khởi tạo Form Inspection cho Object không tồn tại.");
        }

        // 2. Chuẩn hóa dữ liệu
        var schemaId = string.IsNullOrWhiteSpace(request.FormSchemaId) ? "default-inspection-schema" : request.FormSchemaId.Trim();
        var formData = string.IsNullOrWhiteSpace(request.FormDataJson) ? "{}" : request.FormDataJson.Trim();

        var entity = new FormInspection
        {
            Id = Guid.NewGuid(),
            ObjectId = request.ObjectId,
            FormSchemaId = schemaId,
            FormDataJson = formData,
            Status = InspectionStatus.Draft,
            SubmittedById = request.SubmitterId,
            SubmittedBy = request.SubmitterName,
            CreatedAt = DateTime.UtcNow
        };

        _context.FormInspections.Add(entity);

        var history = new InspectionAuditHistory
        {
            Id = Guid.NewGuid(),
            InspectionId = entity.Id,
            FromStatus = InspectionStatus.Draft,
            ToStatus = InspectionStatus.Draft,
            Action = "CreateDraft",
            ActorId = request.SubmitterId,
            ActorName = request.SubmitterName ?? "Submitter",
            ActorRole = "Submitter",
            Comment = "Kỹ sư hiện trường khởi tạo bản ghi hồ sơ kiểm tra (Bản nháp).",
            CreatedAt = DateTime.UtcNow
        };
        _context.InspectionAuditHistories.Add(history);

        await _context.SaveChangesAsync(cancellationToken);

        return new InspectionDto
        {
            Id = entity.Id,
            ObjectId = constructionObject.Id,
            ObjectName = constructionObject.Name,
            DrawingFileId = constructionObject.DrawingFileId,
            DrawingFileName = constructionObject.DrawingFile?.FileName ?? string.Empty,
            DrawingPageNumber = constructionObject.PageNumber,
            FormSchemaId = entity.FormSchemaId,
            FormDataJson = entity.FormDataJson,
            Status = entity.Status.ToString(),
            WorkflowInstanceId = entity.WorkflowInstanceId,
            SubmittedById = entity.SubmittedById,
            SubmittedBy = entity.SubmittedBy,
            SubmittedAt = entity.SubmittedAt,
            ReviewedById = entity.ReviewedById,
            ReviewedBy = entity.ReviewedBy,
            ReviewedAt = entity.ReviewedAt,
            ApprovedById = entity.ApprovedById,
            ApprovedBy = entity.ApprovedBy,
            ApprovedAt = entity.ApprovedAt,
            RejectReason = entity.RejectReason,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            LinkedChecklistItemsCount = 0
        };
    }
}
