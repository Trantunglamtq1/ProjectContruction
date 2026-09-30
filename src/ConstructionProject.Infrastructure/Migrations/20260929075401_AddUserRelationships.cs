using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConstructionProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserRelationships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CreatedById",
                table: "Objects",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ApprovedById",
                table: "FormInspections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewedById",
                table: "FormInspections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SubmittedById",
                table: "FormInspections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UploadedById",
                table: "DrawingFiles",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "Checklists",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedById",
                table: "Checklists",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Objects_CreatedById",
                table: "Objects",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_FormInspections_ApprovedById",
                table: "FormInspections",
                column: "ApprovedById");

            migrationBuilder.CreateIndex(
                name: "IX_FormInspections_ReviewedById",
                table: "FormInspections",
                column: "ReviewedById");

            migrationBuilder.CreateIndex(
                name: "IX_FormInspections_SubmittedById",
                table: "FormInspections",
                column: "SubmittedById");

            migrationBuilder.CreateIndex(
                name: "IX_DrawingFiles_UploadedById",
                table: "DrawingFiles",
                column: "UploadedById");

            migrationBuilder.CreateIndex(
                name: "IX_Checklists_CreatedById",
                table: "Checklists",
                column: "CreatedById");

            migrationBuilder.AddForeignKey(
                name: "FK_Checklists_Users_CreatedById",
                table: "Checklists",
                column: "CreatedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DrawingFiles_Users_UploadedById",
                table: "DrawingFiles",
                column: "UploadedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_FormInspections_Users_ApprovedById",
                table: "FormInspections",
                column: "ApprovedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_FormInspections_Users_ReviewedById",
                table: "FormInspections",
                column: "ReviewedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_FormInspections_Users_SubmittedById",
                table: "FormInspections",
                column: "SubmittedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Objects_Users_CreatedById",
                table: "Objects",
                column: "CreatedById",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Checklists_Users_CreatedById",
                table: "Checklists");

            migrationBuilder.DropForeignKey(
                name: "FK_DrawingFiles_Users_UploadedById",
                table: "DrawingFiles");

            migrationBuilder.DropForeignKey(
                name: "FK_FormInspections_Users_ApprovedById",
                table: "FormInspections");

            migrationBuilder.DropForeignKey(
                name: "FK_FormInspections_Users_ReviewedById",
                table: "FormInspections");

            migrationBuilder.DropForeignKey(
                name: "FK_FormInspections_Users_SubmittedById",
                table: "FormInspections");

            migrationBuilder.DropForeignKey(
                name: "FK_Objects_Users_CreatedById",
                table: "Objects");

            migrationBuilder.DropIndex(
                name: "IX_Objects_CreatedById",
                table: "Objects");

            migrationBuilder.DropIndex(
                name: "IX_FormInspections_ApprovedById",
                table: "FormInspections");

            migrationBuilder.DropIndex(
                name: "IX_FormInspections_ReviewedById",
                table: "FormInspections");

            migrationBuilder.DropIndex(
                name: "IX_FormInspections_SubmittedById",
                table: "FormInspections");

            migrationBuilder.DropIndex(
                name: "IX_DrawingFiles_UploadedById",
                table: "DrawingFiles");

            migrationBuilder.DropIndex(
                name: "IX_Checklists_CreatedById",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "Objects");

            migrationBuilder.DropColumn(
                name: "ApprovedById",
                table: "FormInspections");

            migrationBuilder.DropColumn(
                name: "ReviewedById",
                table: "FormInspections");

            migrationBuilder.DropColumn(
                name: "SubmittedById",
                table: "FormInspections");

            migrationBuilder.DropColumn(
                name: "UploadedById",
                table: "DrawingFiles");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Checklists");

            migrationBuilder.DropColumn(
                name: "CreatedById",
                table: "Checklists");
        }
    }
}
