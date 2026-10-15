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

            migrationBuilder.CreateIndex(
                name: "IX_FormInspections_WorkflowInstanceId",
                table: "FormInspections",
                column: "WorkflowInstanceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FormInspections_WorkflowInstanceId",
                table: "FormInspections");

            migrationBuilder.DropColumn(
                name: "WorkflowInstanceId",
                table: "FormInspections");
        }
    }
}
