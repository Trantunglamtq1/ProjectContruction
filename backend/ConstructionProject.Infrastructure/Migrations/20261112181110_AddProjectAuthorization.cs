using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConstructionProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectAuthorization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProjectId",
                table: "Notifications",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProjectId",
                table: "DrawingFiles",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("aaaaaaaa-0000-0000-0000-000000000001"));

            migrationBuilder.CreateTable(
                name: "Projects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Projects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProjectAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StoredFileName = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    OriginalName = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Size = table.Column<long>(type: "bigint", nullable: false),
                    UploadedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProjectAttachments_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProjectAttachments_Users_UploadedById",
                        column: x => x.UploadedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProjectMembers",
                columns: table => new
                {
                    ProjectId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AssignedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectMembers", x => new { x.ProjectId, x.UserId });
                    table.ForeignKey(
                        name: "FK_ProjectMembers_Projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProjectMembers_Users_AssignedById",
                        column: x => x.AssignedById,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProjectMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "Projects",
                columns: new[] { "Id", "Code", "CreatedAt", "Name" },
                values: new object[] { new Guid("aaaaaaaa-0000-0000-0000-000000000001"), "LEGACY", new DateTime(2026, 11, 13, 0, 0, 0, 0, DateTimeKind.Utc), "Dữ liệu chuyển đổi" });


            // All pre-project data is quarantined; deliberately seed no memberships.
            migrationBuilder.Sql("""
                UPDATE Notifications SET ProjectId = 'aaaaaaaa-0000-0000-0000-000000000001';
                -- Keep original shared rows for history; create independent recipient copies.
                -- These copies remain inaccessible until Admin explicitly assigns LEGACY membership.
                INSERT INTO Notifications (Id,UserId,RoleName,Title,Content,Type,TargetUrl,ReferenceId,ReferenceType,IsRead,CreatedAt,ProjectId)
                SELECT NEWID(),u.Id,NULL,n.Title,n.Content,n.Type,n.TargetUrl,n.ReferenceId,n.ReferenceType,n.IsRead,n.CreatedAt,n.ProjectId
                FROM Notifications n CROSS JOIN Users u LEFT JOIN Roles r ON r.Id = u.RoleId
                WHERE n.UserId IS NULL AND (n.RoleName IS NULL OR n.RoleName = r.Name);
                WITH AttachmentRefs AS (
                    SELECT
                        JSON_VALUE(CASE WHEN a.type = 5 THEN a.value ELSE N'{}' END, '$.storedFileName') AS StoredName,
                        JSON_VALUE(CASE WHEN a.type = 5 THEN a.value ELSE N'{}' END, '$.originalName') AS OriginalName,
                        TRY_CONVERT(bigint, JSON_VALUE(CASE WHEN a.type = 5 THEN a.value ELSE N'{}' END, '$.size')) AS FileSize,
                        i.CreatedAt
                    FROM FormInspections i
                    CROSS APPLY OPENJSON(CASE WHEN ISJSON(i.FormDataJson) = 1 THEN i.FormDataJson ELSE N'{}' END, '$.attachments') a
                ), ValidRefs AS (
                    SELECT *, ROW_NUMBER() OVER (PARTITION BY StoredName ORDER BY CreatedAt) AS rn
                    FROM AttachmentRefs
                    WHERE LEN(StoredName) BETWEEN 1 AND 512
                        AND CHARINDEX('/', StoredName) = 0 AND CHARINDEX('\', StoredName) = 0
                        AND (LOWER(StoredName) LIKE '%.pdf' OR LOWER(StoredName) LIKE '%.jpg'
                          OR LOWER(StoredName) LIKE '%.jpeg' OR LOWER(StoredName) LIKE '%.png'
                          OR LOWER(StoredName) LIKE '%.webp' OR LOWER(StoredName) LIKE '%.heic')
                )
                INSERT INTO ProjectAttachments (Id,ProjectId,StoredFileName,OriginalName,ContentType,Size,UploadedAt)
                SELECT NEWID(),'aaaaaaaa-0000-0000-0000-000000000001',StoredName,
                    LEFT(COALESCE(NULLIF(OriginalName,''),StoredName),512),
                    CASE WHEN LOWER(StoredName) LIKE '%.pdf' THEN 'application/pdf'
                      WHEN LOWER(StoredName) LIKE '%.png' THEN 'image/png'
                      WHEN LOWER(StoredName) LIKE '%.webp' THEN 'image/webp'
                      WHEN LOWER(StoredName) LIKE '%.heic' THEN 'image/heic' ELSE 'image/jpeg' END,
                    CASE WHEN FileSize > 0 THEN FileSize ELSE 0 END,CreatedAt
                FROM ValidRefs WHERE rn = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_ProjectId",
                table: "Notifications",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_DrawingFiles_ProjectId",
                table: "DrawingFiles",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAttachments_ProjectId",
                table: "ProjectAttachments",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAttachments_StoredFileName",
                table: "ProjectAttachments",
                column: "StoredFileName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAttachments_UploadedById",
                table: "ProjectAttachments",
                column: "UploadedById");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectMembers_AssignedById",
                table: "ProjectMembers",
                column: "AssignedById");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectMembers_UserId_ProjectId",
                table: "ProjectMembers",
                columns: new[] { "UserId", "ProjectId" });

            migrationBuilder.CreateIndex(
                name: "IX_Projects_Code",
                table: "Projects",
                column: "Code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_DrawingFiles_Projects_ProjectId",
                table: "DrawingFiles",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Projects_ProjectId",
                table: "Notifications",
                column: "ProjectId",
                principalTable: "Projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DrawingFiles_Projects_ProjectId",
                table: "DrawingFiles");

            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Projects_ProjectId",
                table: "Notifications");

            migrationBuilder.DropTable(
                name: "ProjectAttachments");

            migrationBuilder.DropTable(
                name: "ProjectMembers");

            migrationBuilder.DropTable(
                name: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_ProjectId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_DrawingFiles_ProjectId",
                table: "DrawingFiles");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "DrawingFiles");
        }
    }
}
