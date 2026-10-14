using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Queries;

public record GetInspectionHistoryQuery(Guid InspectionId) : IRequest<List<InspectionAuditHistoryDto>>;

public class GetInspectionHistoryQueryHandler : IRequestHandler<GetInspectionHistoryQuery, List<InspectionAuditHistoryDto>>
{
    private readonly IApplicationDbContext _context;

    public GetInspectionHistoryQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<InspectionAuditHistoryDto>> Handle(GetInspectionHistoryQuery request, CancellationToken cancellationToken)
    {
        var histories = await _context.InspectionAuditHistories
            .AsNoTracking()
            .Where(h => h.InspectionId == request.InspectionId)
            .OrderBy(h => h.CreatedAt)
            .Select(h => new InspectionAuditHistoryDto
            {
                Id = h.Id,
                InspectionId = h.InspectionId,
                FromStatus = h.FromStatus.ToString(),
                ToStatus = h.ToStatus.ToString(),
                Action = h.Action,
                ActorId = h.ActorId,
                ActorName = h.ActorName,
                ActorRole = h.ActorRole,
                Comment = h.Comment,
                CreatedAt = h.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return histories;
    }
}
