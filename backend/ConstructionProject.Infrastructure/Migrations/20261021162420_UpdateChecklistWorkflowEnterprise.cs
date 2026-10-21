using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConstructionProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateChecklistWorkflowEnterprise : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Checklists",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "RejectReason",
                table: "Checklists",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAt",
                table: "Checklists",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewedBy",
                table: "Checklists",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedById",
                table: "Checklists",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Checklists",
                type: "rowversion",
                rowVersion: true,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WorkflowInstanceId",
                table: "Checklists",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FormSchemaJson",
                table: "ChecklistItems",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "ChecklistItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "OrderIndex",
                table: "ChecklistItems",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "ChecklistItems",
                type: "rowversion",
                rowVersion: true,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ChecklistAuditHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChecklistId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FromStatus = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ToStatus = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ActorName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ActorRole = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    DetailsJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistAuditHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChecklistAuditHistories_Checklists_ChecklistId",
                        column: x => x.ChecklistId,
                        principalTable: "Checklists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_ReviewedById",
                table: "Checklists",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistAuditHistories_ChecklistId",
                table: "ChecklistAuditHistories",
                column: "ChecklistId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistAuditHistories_CreatedAt",
                table: "ChecklistAuditHistories",
                column: "CreatedAt");

            migrationBuilder.AddForeignKey(
                name: "FK_Checklists_Users_ReviewedById",
                table: "Checklists",
                column: "ReviewedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Checklists_Users_ReviewedById",
                table: "Checklists");

            migrationBuilder.DropTable(
                name: "ChecklistAuditHistories");

            migrationBuilder.DropIndex(
                name: "IX_Checklists_ReviewedById",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "RejectReason",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "ReviewedAt",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "ReviewedBy",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "ReviewedById",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "WorkflowInstanceId",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "FormSchemaJson",
                table: "ChecklistItems");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "ChecklistItems");

            migrationBuilder.DropColumn(
                name: "OrderIndex",
                table: "ChecklistItems");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "ChecklistItems");
        }
    }
}
