using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConstructionProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddChecklistWorkflowOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChecklistWorkflowOperations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChecklistId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InstanceId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PreviousInstanceId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Action = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ActorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    AttemptCount = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    NextAttemptAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastError = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistWorkflowOperations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChecklistWorkflowOperations_Checklists_ChecklistId",
                        column: x => x.ChecklistId,
                        principalTable: "Checklists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistWorkflowOperations_ChecklistId",
                table: "ChecklistWorkflowOperations",
                column: "ChecklistId",
                unique: true,
                filter: "[CompletedAt] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistWorkflowOperations_CompletedAt_NextAttemptAt",
                table: "ChecklistWorkflowOperations",
                columns: new[] { "CompletedAt", "NextAttemptAt" });

            // Legacy checklist workflow state existed only in process memory.
            // Preserve its identifier and reconstruct the pending bookmark from business state.
            migrationBuilder.Sql(@"
DECLARE @queued TABLE (ChecklistId uniqueidentifier NOT NULL);
INSERT INTO [ChecklistWorkflowOperations]
    ([Id], [ChecklistId], [InstanceId], [PreviousInstanceId], [Action], [AttemptCount], [CreatedAt], [NextAttemptAt])
OUTPUT inserted.[ChecklistId] INTO @queued
SELECT NEWID(), c.[Id], REPLACE(CONVERT(nvarchar(36), NEWID()), N'-', N''), c.[WorkflowInstanceId],
       N'Recover', 0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM [Checklists] c
WHERE c.[Status] = N'PendingSupervisor' AND c.[IsDeleted] = 0;
UPDATE c SET [WorkflowInstanceId] = NULL
FROM [Checklists] c INNER JOIN @queued q ON q.[ChecklistId] = c.[Id];");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("Không thể tự động đảo migration vì có thể mất dữ liệu phục hồi workflow.");
        }
    }
}
