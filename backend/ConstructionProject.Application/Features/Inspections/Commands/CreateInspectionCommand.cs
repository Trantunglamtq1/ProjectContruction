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
    Guid ChecklistId,
    Guid ChecklistItemId,
    Guid? ObjectId = null,
    string? FormDataJson = null,
    bool SubmitImmediately = false,
    Guid? SubmitterId = null,
    string? SubmitterName = null
) : IRequest<InspectionDto>;

public class CreateInspectionCommandValidator : AbstractValidator<CreateInspectionCommand>
{
    public CreateInspectionCommandValidator()
    {
        RuleFor(x => x.ChecklistId)
            .NotEmpty().WithMessage("ChecklistId là bắt buộc. Form Inspection là một hạng mục trong Checklist và phải luôn gắn liền với một Checklist cố định.");

        RuleFor(x => x.ChecklistItemId)
            .NotEmpty().WithMessage("ChecklistItemId là bắt buộc. Form Inspection phải gắn liền với một tiêu chí (ChecklistItem) cụ thể.");

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
    private readonly IInspectionWorkflowService _workflowService;
    private readonly INotificationService _notificationService;

    public CreateInspectionCommandHandler(
        IApplicationDbContext context, 
        IInspectionWorkflowService workflowService,
        INotificationService notificationService)
    {
        _context = context;
        _workflowService = workflowService;
        _notificationService = notificationService;
    }

    public async Task<InspectionDto> Handle(CreateInspectionCommand request, CancellationToken cancellationToken)
    {
        // 1. Kiểm tra Checklist và nạp Items + Object
        var checklist = await _context.Checklists
            .Include(c => c.Items)
            .Include(c => c.Object)
                .ThenInclude(o => o!.DrawingFile)
            .FirstOrDefaultAsync(c => c.Id == request.ChecklistId, cancellationToken);

        if (checklist == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy Checklist với Id = {request.ChecklistId}. Form Inspection không thể đứng riêng lẻ mà bắt buộc phải thuộc về 1 Checklist.");
        }

        // 2. Kiểm tra điều kiện trạng thái: Chỉ mở khóa điền phiếu nghiệm thu khi Kế hoạch Checklist đã được Giám sát Approved
        if (checklist.Status != ChecklistStatus.Approved && checklist.Status != ChecklistStatus.InProgress)
        {
            throw new InvalidOperationException($"Chỉ được tạo phiếu nghiệm thu khi Kế hoạch Checklist đã được Giám sát phê duyệt ('Approved' hoặc 'InProgress'). Trạng thái hiện tại: '{checklist.Status}'.");
        }

        // 3. Kiểm tra ChecklistItem
        var item = checklist.Items.FirstOrDefault(i => i.Id == request.ChecklistItemId && !i.IsDeleted);
        if (item == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy tiêu chí ChecklistItem với Id = {request.ChecklistItemId} trong Checklist '{checklist.Name}'.");
        }

        var constructionObject = checklist.Object;
        if (constructionObject == null)
        {
            throw new InvalidOperationException("Checklist chưa được liên kết với cấu kiện Object hợp lệ.");
        }

        // 4. Chuẩn hóa FormDataJson
        var formData = string.IsNullOrWhiteSpace(request.FormDataJson) ? "{}" : request.FormDataJson.Trim();

        // 5. Kiểm tra nếu đã có phiếu nghiệm thu liên kết trước đó
        FormInspection entity;
        if (item.LinkedInspectionId.HasValue)
        {
            var existingInspection = await _context.FormInspections
                .FirstOrDefaultAsync(i => i.Id == item.LinkedInspectionId.Value, cancellationToken);

            if (existingInspection != null)
            {
                // Nếu phiếu đã Approved thì không cho ghi đè
                if (existingInspection.Status == InspectionStatus.Approved)
                {
                    throw new InvalidOperationException("Tiêu chí này đã được phê duyệt nghiệm thu (Approved). Không thể tạo mới hoặc ghi đè.");
                }

                entity = existingInspection;
                entity.FormDataJson = formData;
                entity.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                entity = new FormInspection
                {
                    Id = Guid.NewGuid(),
                    ObjectId = checklist.ObjectId,
                    ChecklistId = checklist.Id,
                    ChecklistItemId = item.Id,
                    FormSchemaId = item.Id.ToString(),
                    FormDataJson = formData,
                    Status = InspectionStatus.Draft,
                    SubmittedById = request.SubmitterId,
                    SubmittedBy = request.SubmitterName,
                    CreatedAt = DateTime.UtcNow
                };
                _context.FormInspections.Add(entity);
            }
        }
        else
        {
            entity = new FormInspection
            {
                Id = Guid.NewGuid(),
                ObjectId = checklist.ObjectId,
                ChecklistId = checklist.Id,
                ChecklistItemId = item.Id,
                FormSchemaId = item.Id.ToString(),
                FormDataJson = formData,
                Status = InspectionStatus.Draft,
                SubmittedById = request.SubmitterId,
                SubmittedBy = request.SubmitterName,
                CreatedAt = DateTime.UtcNow
            };
            _context.FormInspections.Add(entity);
        }

        // Gắn liên kết 2 chiều
        item.LinkedInspectionId = entity.Id;
        entity.ChecklistId = checklist.Id;
        entity.ChecklistItemId = item.Id;

        // Chuyển trạng thái Checklist sang InProgress nếu đang là Approved
        if (checklist.Status == ChecklistStatus.Approved)
        {
            checklist.Status = ChecklistStatus.InProgress;
        }

        // 6. Xử lý nộp ngay nếu submitImmediately = true
        if (request.SubmitImmediately)
        {
            entity.Status = InspectionStatus.Submitted;
            entity.SubmittedAt = DateTime.UtcNow;
            entity.SubmittedById = request.SubmitterId;
            entity.SubmittedBy = request.SubmitterName ?? "Submitter";

            var workflowInstanceId = await _workflowService.StartApprovalWorkflowAsync(
                entity.Id,
                entity.SubmittedBy,
                cancellationToken);

            if (!string.IsNullOrWhiteSpace(workflowInstanceId))
            {
                entity.WorkflowInstanceId = workflowInstanceId;
            }

            var submitAudit = new InspectionAuditHistory
            {
                Id = Guid.NewGuid(),
                InspectionId = entity.Id,
                FromStatus = InspectionStatus.Draft,
                ToStatus = InspectionStatus.Submitted,
                Action = "Submit",
                ActorId = request.SubmitterId,
                ActorName = request.SubmitterName ?? "Submitter",
                ActorRole = "Submitter",
                Comment = $"Kỹ sư hiện trường nộp hồ sơ nghiệm thu cho tiêu chí '{item.Name}' thuộc Checklist '{checklist.Name}'.",
                CreatedAt = DateTime.UtcNow
            };
            _context.InspectionAuditHistories.Add(submitAudit);
        }
        else
        {
            var draftAudit = new InspectionAuditHistory
            {
                Id = Guid.NewGuid(),
                InspectionId = entity.Id,
                FromStatus = InspectionStatus.Draft,
                ToStatus = InspectionStatus.Draft,
                Action = "SaveDraft",
                ActorId = request.SubmitterId,
                ActorName = request.SubmitterName ?? "Submitter",
                ActorRole = "Submitter",
                Comment = $"Kỹ sư hiện trường lưu nháp phiếu nghiệm thu cho tiêu chí '{item.Name}' thuộc Checklist '{checklist.Name}'.",
                CreatedAt = DateTime.UtcNow
            };
            _context.InspectionAuditHistories.Add(draftAudit);
        }

        await _context.SaveChangesAsync(cancellationToken);

        if (request.SubmitImmediately)
        {
            await _notificationService.SendNotificationToRoleAsync("Reviewer", new NotificationMessage
            {
                Title = "Hồ sơ nghiệm thu mới cần thẩm tra",
                Content = $"Kỹ sư {entity.SubmittedBy ?? "hiện trường"} đã nộp hồ sơ kiểm tra cho tiêu chí '{item.Name}' thuộc cấu kiện '{constructionObject.Name}'",
                Type = "info",
                ReferenceId = entity.Id.ToString(),
                ReferenceType = "Inspection",
                TargetUrl = "/reviewer/checklists"
            }, cancellationToken);
        }

        return new InspectionDto
        {
            Id = entity.Id,
            ObjectId = constructionObject.Id,
            ObjectName = constructionObject.Name,
            DrawingFileId = constructionObject.DrawingFileId,
            DrawingFileName = constructionObject.DrawingFile?.FileName ?? string.Empty,
            DrawingPageNumber = constructionObject.PageNumber,
            ChecklistId = checklist.Id,
            ChecklistName = checklist.Name,
            ChecklistItemId = item.Id,
            ChecklistItemName = item.Name,
            FormSchemaId = entity.FormSchemaId,
            FormSchemaJson = item.FormSchemaJson,
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
            LinkedChecklistItemsCount = 1
        };
    }
}
