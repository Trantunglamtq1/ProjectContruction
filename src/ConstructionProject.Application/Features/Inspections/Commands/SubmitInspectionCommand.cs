using System.Text.Json;
using ConstructionProject.Application.Common.Interfaces;
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
    string? SubmitterName = null
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
    private readonly IInspectionWorkflowService _workflowService;

    public SubmitInspectionCommandHandler(IApplicationDbContext context, IInspectionWorkflowService workflowService)
    {
        _context = context;
        _workflowService = workflowService;
    }

    public async Task<InspectionDto> Handle(SubmitInspectionCommand request, CancellationToken cancellationToken)
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

        // Chỉ cho phép submit khi trạng thái là Draft hoặc Rejected (resubmit sau khi bị từ chối)
        if (inspection.Status != InspectionStatus.Draft && inspection.Status != InspectionStatus.Rejected)
        {
            throw new InvalidOperationException($"Không thể nộp đơn kiểm tra đang ở trạng thái '{inspection.Status}'. Đơn chỉ có thể nộp khi là 'Draft' hoặc 'Rejected'.");
        }

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
        var workflowInstanceId = await _workflowService.StartApprovalWorkflowAsync(
            inspection.Id,
            inspection.SubmittedBy,
            cancellationToken);

        if (!string.IsNullOrWhiteSpace(workflowInstanceId))
        {
            inspection.WorkflowInstanceId = workflowInstanceId;
        }

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
                ? $"Kỹ sư hiện trường đã khắc phục lỗi và gửi lại hồ sơ (Resubmit). Elsa Workflow Instance: {inspection.WorkflowInstanceId}." 
                : $"Kỹ sư hiện trường đã nộp hồ sơ kiểm tra để chờ thẩm tra. Elsa Workflow Instance: {inspection.WorkflowInstanceId}.",
            CreatedAt = DateTime.UtcNow
        };
        _context.InspectionAuditHistories.Add(history);

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

    private static void ValidateFormDataAgainstSchema(string json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "{}")
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

            // Kiểm tra các trường bắt buộc cơ bản theo schema default-inspection-schema
            // 1. Tiêu đề hạng mục kiểm tra
            bool hasTitle = (root.TryGetProperty("inspectionTitle", out var titleProp) || root.TryGetProperty("title", out titleProp))
                            && !string.IsNullOrWhiteSpace(titleProp.GetString());

            if (!hasTitle)
            {
                throw new InvalidOperationException("Vui lòng nhập 'Tên hạng mục kiểm tra' (inspectionTitle) trước khi gửi duyệt.");
            }

            // 2. Kết quả đánh giá
            bool hasResult = root.TryGetProperty("result", out var resultProp) && !string.IsNullOrWhiteSpace(resultProp.GetString());
            if (!hasResult)
            {
                throw new InvalidOperationException("Vui lòng chọn 'Kết quả đánh giá' (result: pass / fail / pending_fix) trước khi gửi duyệt.");
            }
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"Định dạng JSON dữ liệu form không hợp lệ: {ex.Message}");
        }
    }
}
