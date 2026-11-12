using System.Text.Json;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Common.Exceptions;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record SubmitInspectionCommand(
    Guid Id,
    string? FormDataJson = null,
    Guid? SubmitterId = null,
    string? SubmitterName = null,
    byte[]? RowVersion = null
) : IRequest<InspectionDto>;

public class SubmitInspectionCommandValidator : AbstractValidator<SubmitInspectionCommand>
{
    public SubmitInspectionCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Id là bắt buộc.");

        RuleFor(x => x.FormDataJson)
            .Must(BeValidJson).When(x => !string.IsNullOrWhiteSpace(x.FormDataJson))
            .WithMessage("FormDataJson gửi lên phải là định dạng JSON hợp lệ.");

        RuleFor(x => x.RowVersion)
            .NotNull().Must(value => value is { Length: 8 })
            .WithMessage("Phiên bản dữ liệu không hợp lệ. Vui lòng tải lại hồ sơ.");
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

public class SubmitInspectionCommandHandler : IRequestHandler<SubmitInspectionCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public SubmitInspectionCommandHandler(
        IApplicationDbContext context, 
        INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<InspectionDto> Handle(SubmitInspectionCommand request, CancellationToken cancellationToken)
    {
        var inspection = await _context.FormInspections
            .Include(i => i.Object)
                .ThenInclude(o => o!.DrawingFile)
            .Include(i => i.Checklist)
            .Include(i => i.ChecklistItem)
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

        // Chỉ cho phép submit khi trạng thái là Draft hoặc Rejected (resubmit sau khi bị từ chối)
        if (inspection.Status != InspectionStatus.Draft && inspection.Status != InspectionStatus.Rejected)
        {
            throw new InvalidOperationException($"Không thể nộp đơn kiểm tra đang ở trạng thái '{inspection.Status}'. Đơn chỉ có thể nộp khi là 'Draft' hoặc 'Rejected'.");
        }

        if (!request.SubmitterId.HasValue || !inspection.SubmittedById.HasValue || request.SubmitterId != inspection.SubmittedById)
            throw new ForbiddenAccessException("Chỉ người tạo hồ sơ mới được nộp hoặc nộp lại hồ sơ.");

        // Cập nhật FormDataJson nếu request có gửi kèm nội dung mới nhất
        if (!string.IsNullOrWhiteSpace(request.FormDataJson))
        {
            inspection.FormDataJson = request.FormDataJson.Trim();
        }

        // Validate nội dung form theo schema FormIO (yêu cầu nghiệp vụ tối thiểu: có tiêu đề và kết quả đánh giá)
        ValidateFormDataAgainstSchema(inspection.FormDataJson);

        var oldStatus = inspection.Status;
        var isResubmit = oldStatus == InspectionStatus.Rejected;

        // Chuyển trạng thái sang Submitted
        inspection.Status = InspectionStatus.Submitted;
        inspection.SubmittedAt = DateTime.UtcNow;
        inspection.UpdatedAt = DateTime.UtcNow;

        if (request.SubmitterId.HasValue)
        {
            inspection.SubmittedById = request.SubmitterId;
        }

        if (!string.IsNullOrWhiteSpace(request.SubmitterName))
        {
            inspection.SubmittedBy = request.SubmitterName;
        }

        // Reset lý do từ chối nếu có từ trước
        inspection.RejectReason = null;

        // Kích hoạt quy trình Elsa Workflow Instance
        InspectionWorkflowQueue.EnqueueStart(_context, inspection, inspection.SubmittedBy);

        var history = new ConstructionProject.Domain.Entities.InspectionAuditHistory
        {
            Id = Guid.NewGuid(),
            InspectionId = inspection.Id,
            FromStatus = oldStatus,
            ToStatus = inspection.Status,
            Action = isResubmit ? "Resubmit" : "Submit",
            ActorId = inspection.SubmittedById,
            ActorName = inspection.SubmittedBy ?? "Submitter",
            ActorRole = "Submitter",
            Comment = isResubmit 
                ? "Kỹ sư hiện trường đã sửa và nộp lại hồ sơ; quy trình đang được đồng bộ."
                : "Kỹ sư hiện trường đã nộp hồ sơ; quy trình đang được đồng bộ.",
            CreatedAt = DateTime.UtcNow
        };
        _context.InspectionAuditHistories.Add(history);

        await _context.SaveChangesAsync(cancellationToken);

        await _notificationService.SendNotificationToRoleAsync("Reviewer", new NotificationMessage
        {
            Title = isResubmit ? "Hồ sơ nộp lại cần thẩm tra" : "Hồ sơ nghiệm thu mới cần thẩm tra",
            Content = $"Kỹ sư {inspection.SubmittedBy ?? "hiện trường"} đã nộp hồ sơ kiểm tra cho cấu kiện '{inspection.Object?.Name ?? "cấu kiện"}'. Quy trình đang được đồng bộ.",
            Type = "info",
            ReferenceId = inspection.Id.ToString(),
            ReferenceType = "Inspection",
            TargetUrl = "/reviewer/checklists"
        }, cancellationToken);

        return new InspectionDto
        {
            Id = inspection.Id,
            ObjectId = inspection.ObjectId,
            ObjectName = inspection.Object?.Name ?? string.Empty,
            DrawingFileId = inspection.Object?.DrawingFileId ?? Guid.Empty,
            DrawingFileName = inspection.Object?.DrawingFile?.FileName ?? string.Empty,
            DrawingPageNumber = inspection.Object?.PageNumber ?? 1,
            ChecklistId = inspection.ChecklistId,
            ChecklistName = inspection.Checklist?.Name,
            ChecklistItemId = inspection.ChecklistItemId,
            ChecklistItemName = inspection.ChecklistItem?.Name,
            FormSchemaId = inspection.FormSchemaId,
            FormSchemaJson = inspection.ChecklistItem?.FormSchemaJson,
            FormDataJson = inspection.FormDataJson,
            Status = inspection.Status.ToString(),
            WorkflowInstanceId = inspection.WorkflowInstanceId,
            RowVersion = inspection.RowVersion,
            WorkflowSyncStatus = "Pending",
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

    internal static void ValidateFormDataAgainstSchema(string json)
    {
        if (string.IsNullOrWhiteSpace(json) || json.Trim() == "{}" || json.Trim() == "[]")
        {
            throw new InvalidOperationException("Không thể gửi duyệt hồ sơ rỗng. Vui lòng điền các thông tin kiểm tra hiện trường trước khi Submit.");
        }

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                throw new InvalidOperationException("Dữ liệu form nộp phải là một JSON Object.");
            }

            int propertyCount = 0;
            foreach (var _ in root.EnumerateObject())
            {
                propertyCount++;
            }

            if (propertyCount == 0)
            {
                throw new InvalidOperationException("Không thể gửi duyệt hồ sơ rỗng. Vui lòng điền các thông tin kiểm tra hiện trường trước khi Submit.");
            }
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"Định dạng JSON dữ liệu form không hợp lệ: {ex.Message}");
        }
    }
}
