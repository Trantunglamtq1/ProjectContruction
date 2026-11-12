using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Common.Exceptions;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record DeleteInspectionCommand(
    Guid Id,
    Guid? CurrentUserId = null,
    byte[]? RowVersion = null
) : IRequest<bool>;

public class DeleteInspectionCommandHandler : IRequestHandler<DeleteInspectionCommand, bool>
{
    private readonly IApplicationDbContext _context;

    public DeleteInspectionCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteInspectionCommand request, CancellationToken cancellationToken)
    {
        var inspection = await _context.FormInspections
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

        if (inspection.Status != InspectionStatus.Draft)
        {
            throw new InvalidOperationException($"Chỉ có thể xóa hồ sơ kiểm tra khi ở trạng thái 'Draft' (Bản nháp). Hồ sơ hiện tại đang ở trạng thái: '{inspection.Status}'.");
        }

        if (!request.CurrentUserId.HasValue || !inspection.SubmittedById.HasValue || inspection.SubmittedById != request.CurrentUserId)
        {
            throw new ForbiddenAccessException("Bạn không có quyền xóa bản nháp của kỹ sư khác.");
        }

        _context.FormInspections.Remove(inspection);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}
