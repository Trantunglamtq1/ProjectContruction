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
            throw new KeyNotFoundException($"Không tìm thấy Object với Id = {request.ObjectId}.");
        }

        var checklists = await _context.Checklists
            .Include(c => c.Items)
            .Where(c => c.ObjectId == request.ObjectId)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var allActiveItems = checklists.SelectMany(c => c.Items.Where(i => !i.IsDeleted)).ToList();

        return new ChecklistSummaryDto
        {
            ObjectId = obj.Id,
            ObjectName = obj.Name,
            TotalChecklists = checklists.Count,
            CompletedChecklists = checklists.Count(c => c.Status == ChecklistStatus.Completed),
            InProgressChecklists = checklists.Count(c => c.Status == ChecklistStatus.InProgress),
            TotalItems = allActiveItems.Count,
            DoneItems = allActiveItems.Count(i => i.Status == ChecklistItemStatus.Done)
        };
    }
}
