using System.Text.Json;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Common.Exceptions;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record UpdateInspectionDraftCommand(
    Guid Id,
    string FormDataJson,
    Guid? CurrentUserId = null,
    byte[]? RowVersion = null
) : IRequest<InspectionDto>;

public class UpdateInspectionDraftCommandValidator : AbstractValidator<UpdateInspectionDraftCommand>
{
    public UpdateInspectionDraftCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Id là bắt buộc.");

        RuleFor(x => x.FormDataJson)
            .NotEmpty().WithMessage("FormDataJson không được để trống.")
            .Must(BeValidJson).WithMessage("FormDataJson phải là định dạng JSON hợp lệ.");

        RuleFor(x => x.RowVersion)
            .NotNull().Must(value => value is { Length: 8 })
            .WithMessage("Phiên bản dữ liệu không hợp lệ. Vui lòng tải lại hồ sơ.");
    }

    private static bool BeValidJson(string json)
    {
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

public class UpdateInspectionDraftCommandHandler : IRequestHandler<UpdateInspectionDraftCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;

    public UpdateInspectionDraftCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<InspectionDto> Handle(UpdateInspectionDraftCommand request, CancellationToken cancellationToken)
    {
        var inspection = await _context.FormInspections
            .Include(i => i.Object)
                .ThenInclude(o => o!.DrawingFile)
            .Include(i => i.LinkedChecklistItems)
            .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

        if (inspection == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy Form Inspection với Id = {request.Id}.");
        }

        if (request.RowVersion is not { Length: 8 })
            throw new InvalidOperationException("Phiên bản dữ liệu không hợp lệ. Vui lòng tải lại hồ sơ.");

        if (inspection.RowVersion == null || !request.RowVersion.SequenceEqual(inspection.RowVersion))
            throw new DbUpdateConcurrencyException();
        await InspectionWorkflowQueue.EnsureReadyAsync(_context, inspection.Id, cancellationToken);

        // Cho phép chỉnh sửa khi trạng thái là Draft hoặc Rejected (nộp lại sau khi bị từ chối)
        if (inspection.Status != InspectionStatus.Draft && inspection.Status != InspectionStatus.Rejected)
        {
            throw new InvalidOperationException($"Chỉ có thể chỉnh sửa hồ sơ kiểm tra khi ở trạng thái 'Draft' hoặc 'Rejected'. Trạng thái hiện tại: {inspection.Status}.");
        }

        // Kiểm tra quyền: Nếu đã lưu SubmittedById thì chỉ chính người đó mới được sửa (hoặc kiểm tra role Submitter)
        if (!request.CurrentUserId.HasValue || !inspection.SubmittedById.HasValue || inspection.SubmittedById != request.CurrentUserId)
        {
            throw new ForbiddenAccessException("Bạn không có quyền chỉnh sửa bản nháp của kỹ sư khác.");
        }

        inspection.FormDataJson = request.FormDataJson.Trim();
        inspection.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return new InspectionDto
        {
            Id = inspection.Id,
            ObjectId = inspection.ObjectId,
            ObjectName = inspection.Object?.Name ?? string.Empty,
            DrawingFileId = inspection.Object?.DrawingFileId ?? Guid.Empty,
            DrawingFileName = inspection.Object?.DrawingFile?.FileName ?? string.Empty,
            DrawingPageNumber = inspection.Object?.PageNumber ?? 1,
            FormSchemaId = inspection.FormSchemaId,
            FormDataJson = inspection.FormDataJson,
            Status = inspection.Status.ToString(),
            WorkflowInstanceId = inspection.WorkflowInstanceId,
            RowVersion = inspection.RowVersion,
            SubmittedById = inspection.SubmittedById,
            SubmittedBy = inspection.SubmittedBy,
            SubmittedAt = inspection.SubmittedAt,
            ReviewedById = inspection.ReviewedById,
            ReviewedBy = inspection.ReviewedBy,
            ReviewedAt = inspection.ReviewedAt,
            ApprovedById = inspection.ApprovedById,
            ApprovedBy = inspection.ApprovedBy,
            ApprovedAt = inspection.ApprovedAt,
            RejectReason = inspection.RejectReason,
            CreatedAt = inspection.CreatedAt,
            UpdatedAt = inspection.UpdatedAt,
            LinkedChecklistItemsCount = inspection.LinkedChecklistItems?.Count ?? 0
        };
    }
}
