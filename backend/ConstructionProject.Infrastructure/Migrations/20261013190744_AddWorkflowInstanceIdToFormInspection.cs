using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConstructionProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkflowInstanceIdToFormInspection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "WorkflowInstanceId",
                table: "FormInspections",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "InspectionAuditHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InspectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromStatus = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ToStatus = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ActorName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    ActorRole = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InspectionAuditHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InspectionAuditHistories_FormInspections_InspectionId",
                        column: x => x.InspectionId,
                        principalTable: "FormInspections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FormInspections_WorkflowInstanceId",
                table: "FormInspections",
                column: "WorkflowInstanceId");

            migrationBuilder.CreateIndex(
                name: "IX_InspectionAuditHistories_CreatedAt",
                table: "InspectionAuditHistories",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_InspectionAuditHistories_InspectionId",
                table: "InspectionAuditHistories",
                column: "InspectionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InspectionAuditHistories");

            migrationBuilder.DropIndex(
                name: "IX_FormInspections_WorkflowInstanceId",
                table: "FormInspections");

            migrationBuilder.DropColumn(
                name: "WorkflowInstanceId",
                table: "FormInspections");
        }
    }
}
