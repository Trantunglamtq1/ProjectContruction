using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ConstructionProject.UnitTests.Inspections;

public class BestEffortNotificationTests
{
    [Fact]
    public async Task DeliveryFailure_DoesNotFailCommittedAction()
    {
        var inner = new Mock<INotificationService>();
        inner.Setup(x => x.SendNotificationToRoleAsync(It.IsAny<string>(), It.IsAny<NotificationMessage>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("delivery failed"));
        var service = new BestEffortNotificationService(inner.Object, NullLogger<BestEffortNotificationService>.Instance);
        await service.SendNotificationToRoleAsync("Reviewer", new NotificationMessage());
    }
}
