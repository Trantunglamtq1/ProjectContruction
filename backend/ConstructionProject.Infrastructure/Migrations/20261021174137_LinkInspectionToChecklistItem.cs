using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConstructionProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class LinkInspectionToChecklistItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ChecklistId",
                table: "FormInspections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ChecklistItemId",
                table: "FormInspections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FormInspections_ChecklistId",
                table: "FormInspections",
                column: "ChecklistId");

            migrationBuilder.CreateIndex(
                name: "IX_FormInspections_ChecklistItemId",
                table: "FormInspections",
                column: "ChecklistItemId");

            migrationBuilder.AddForeignKey(
                name: "FK_FormInspections_ChecklistItems_ChecklistItemId",
                table: "FormInspections",
                column: "ChecklistItemId",
                principalTable: "ChecklistItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_FormInspections_Checklists_ChecklistId",
                table: "FormInspections",
                column: "ChecklistId",
                principalTable: "Checklists",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_FormInspections_ChecklistItems_ChecklistItemId",
                table: "FormInspections");

            migrationBuilder.DropForeignKey(
                name: "FK_FormInspections_Checklists_ChecklistId",
                table: "FormInspections");

            migrationBuilder.DropIndex(
                name: "IX_FormInspections_ChecklistId",
                table: "FormInspections");

            migrationBuilder.DropIndex(
                name: "IX_FormInspections_ChecklistItemId",
                table: "FormInspections");

            migrationBuilder.DropColumn(
                name: "ChecklistId",
                table: "FormInspections");

            migrationBuilder.DropColumn(
                name: "ChecklistItemId",
                table: "FormInspections");
        }
    }
}
