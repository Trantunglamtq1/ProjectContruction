using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

internal static class InspectionVersionGuard
{
    public static void EnsureCurrent(byte[]? expected, byte[]? current)
    {
        if (expected is not { Length: 8 })
            throw new InvalidOperationException("Phiên bản dữ liệu không hợp lệ. Vui lòng tải lại hồ sơ.");
        if (current == null || !expected.SequenceEqual(current))
            throw new DbUpdateConcurrencyException();
    }
}
