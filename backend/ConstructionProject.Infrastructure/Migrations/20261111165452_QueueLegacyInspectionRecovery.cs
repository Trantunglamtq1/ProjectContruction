using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConstructionProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class QueueLegacyInspectionRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PreviousInstanceId",
                table: "InspectionWorkflowOperations",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            // Existing workflow state was stored in process memory and cannot be trusted
            // after deployment. Preserve the old identifier and queue deterministic recovery.
            migrationBuilder.Sql(@"
DECLARE @queued TABLE (InspectionId uniqueidentifier NOT NULL);
INSERT INTO [InspectionWorkflowOperations]
    ([Id], [InspectionId], [InstanceId], [PreviousInstanceId], [Action], [AttemptCount], [CreatedAt], [NextAttemptAt])
OUTPUT inserted.[InspectionId] INTO @queued
SELECT NEWID(), i.[Id], REPLACE(CONVERT(nvarchar(36), NEWID()), N'-', N''), i.[WorkflowInstanceId],
       CASE WHEN i.[Status] = N'Reviewed' THEN N'RecoverApprover' ELSE N'RecoverReviewer' END,
       0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM [FormInspections] i
WHERE i.[Status] IN (N'Submitted', N'UnderReview', N'Reviewed')
  AND NOT EXISTS (SELECT 1 FROM [InspectionWorkflowOperations] o WHERE o.[InspectionId] = i.[Id] AND o.[CompletedAt] IS NULL);
UPDATE i SET [WorkflowInstanceId] = NULL
FROM [FormInspections] i INNER JOIN @queued q ON q.[InspectionId] = i.[Id];");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("Không thể tự động đảo migration khôi phục workflow vì có thể làm mất thông tin đối soát.");
        }
    }
}
