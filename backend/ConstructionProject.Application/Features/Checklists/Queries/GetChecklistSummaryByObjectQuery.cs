using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Queries;

public record GetChecklistSummaryByObjectQuery(Guid ObjectId) : IRequest<ChecklistSummaryDto>;

public class GetChecklistSummaryByObjectQueryHandler : IRequestHandler<GetChecklistSummaryByObjectQuery, ChecklistSummaryDto>
{
    private readonly IApplicationDbContext _context;

    public GetChecklistSummaryByObjectQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ChecklistSummaryDto> Handle(GetChecklistSummaryByObjectQuery request, CancellationToken cancellationToken)
    {
        var obj = await _context.Objects
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == request.ObjectId, cancellationToken);

        if (obj == null)
        {
            // Trả về empty summary thay vì 404 để frontend có thể hiển thị modal tạo checklist
            return new ChecklistSummaryDto
            {
                ObjectId = request.ObjectId,
                ObjectName = string.Empty,
                ObjectCode = string.Empty,
                TotalChecklists = 0,
                CompletedChecklists = 0,
                InProgressChecklists = 0,
                TotalItems = 0,
                DoneItems = 0,
                Checklists = []
            };
        }

        var checklists = await _context.Checklists
            .Include(c => c.Items)
                .ThenInclude(i => i.LinkedInspection)
            .Include(c => c.AuditHistories)
            .Where(c => c.ObjectId == request.ObjectId)
            .AsNoTracking()
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        var allActiveItems = checklists.SelectMany(c => c.Items.Where(i => !i.IsDeleted)).ToList();

        var checklistDtos = checklists.Select(c =>
        {
            var activeItems = c.Items.Where(i => !i.IsDeleted).ToList();
            return new ChecklistDto
            {
                Id = c.Id,
                ObjectId = c.ObjectId,
                ObjectName = obj.Name,
                ObjectCode = obj.Name,
                DrawingFileId = obj.DrawingFileId,
                Name = c.Name,
                Description = c.Description,
                Status = c.Status.ToString(),
                WorkflowInstanceId = c.WorkflowInstanceId,
                RejectReason = c.RejectReason,
                CreatedById = c.CreatedById,
                CreatedBy = c.CreatedBy,
                CreatedAt = c.CreatedAt,
                ReviewedById = c.ReviewedById,
                ReviewedBy = c.ReviewedBy,
                ReviewedAt = c.ReviewedAt,
                ItemsCount = activeItems.Count,
                RequiredItemsCount = activeItems.Count(i => i.IsRequired),
                DoneItemsCount = activeItems.Count(i => i.Status == ChecklistItemStatus.Done),
                Items = activeItems.OrderBy(i => i.OrderIndex).Select(i => new ChecklistItemDto
                {
                    Id = i.Id,
                    ChecklistId = i.ChecklistId,
                    Name = i.Name,
                    OrderIndex = i.OrderIndex,
                    IsRequired = i.IsRequired,
                    FormSchemaJson = i.FormSchemaJson,
                    LinkedInspectionId = i.LinkedInspectionId,
                    LinkedInspectionStatus = i.LinkedInspection?.Status.ToString(),
                    Status = i.Status.ToString()
                }).ToList(),
                AuditHistories = c.AuditHistories.OrderByDescending(a => a.CreatedAt).Select(a => new ChecklistAuditHistoryDto
                {
                    Id = a.Id,
                    ChecklistId = a.ChecklistId,
                    FromStatus = a.FromStatus,
                    ToStatus = a.ToStatus,
                    Action = a.Action,
                    ActorId = a.ActorId,
                    ActorName = a.ActorName,
                    ActorRole = a.ActorRole,
                    Comment = a.Comment,
                    CreatedAt = a.CreatedAt
                }).ToList()
            };
        }).ToList();

        return new ChecklistSummaryDto
        {
            ObjectId = obj.Id,
            ObjectName = obj.Name,
            ObjectCode = obj.Name,
            TotalChecklists = checklists.Count,
            CompletedChecklists = checklists.Count(c => c.Status == ChecklistStatus.Completed),
            InProgressChecklists = checklists.Count(c => c.Status == ChecklistStatus.InProgress),
            TotalItems = allActiveItems.Count,
            DoneItems = allActiveItems.Count(i => i.Status == ChecklistItemStatus.Done),
            Checklists = checklistDtos
        };
    }
}
