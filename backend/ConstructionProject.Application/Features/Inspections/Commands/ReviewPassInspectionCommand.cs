using ConstructionProject.Application.DTOs;
using MediatR;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record ReviewPassInspectionCommand(
    Guid Id,
    Guid? ReviewerId = null,
    string? ReviewerName = null,
    string? Comment = null
) : IRequest<InspectionDto>;

public class ReviewPassInspectionCommandHandler : IRequestHandler<ReviewPassInspectionCommand, InspectionDto>
{
    private readonly IMediator _mediator;

    public ReviewPassInspectionCommandHandler(IMediator mediator)
    {
        _mediator = mediator;
    }

    public Task<InspectionDto> Handle(ReviewPassInspectionCommand request, CancellationToken cancellationToken)
    {
        return _mediator.Send(new ReviewInspectionCommand(request.Id, request.ReviewerId, request.ReviewerName, request.Comment), cancellationToken);
    }
}
