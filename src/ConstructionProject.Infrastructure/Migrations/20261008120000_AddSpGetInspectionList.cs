using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ConstructionProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSpGetInspectionList : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE OR ALTER PROCEDURE sp_GetInspectionList
                    @ObjectId UNIQUEIDENTIFIER = NULL,
                    @DrawingFileId UNIQUEIDENTIFIER = NULL,
                    @Status NVARCHAR(50) = NULL,
                    @Search NVARCHAR(200) = NULL,
                    @PageNumber INT = 1,
                    @PageSize INT = 10
                AS
                BEGIN
                    SET NOCOUNT ON;

                    IF @PageNumber < 1 SET @PageNumber = 1;
                    IF @PageSize < 1 SET @PageSize = 10;
                    IF @PageSize > 100 SET @PageSize = 100;

                    DECLARE @Offset INT = (@PageNumber - 1) * @PageSize;

                    WITH FilteredData AS (
                        SELECT 
                            i.Id,
                            i.ObjectId,
                            o.Name AS ObjectName,
                            o.DrawingFileId,
                            d.FileName AS DrawingFileName,
                            o.PageNumber AS DrawingPageNumber,
                            i.FormSchemaId,
                            i.FormDataJson,
                            i.Status,
                            i.SubmittedById,
                            i.SubmittedBy,
                            i.SubmittedAt,
                            i.ReviewedById,
                            i.ReviewedBy,
                            i.ReviewedAt,
                            i.ApprovedById,
                            i.ApprovedBy,
                            i.ApprovedAt,
                            i.RejectReason,
                            i.CreatedAt,
                            i.UpdatedAt,
                            COUNT(ci.Id) AS LinkedChecklistItemsCount
                        FROM FormInspections i
                        INNER JOIN Objects o ON i.ObjectId = o.Id
                        LEFT JOIN DrawingFiles d ON o.DrawingFileId = d.Id
                        LEFT JOIN ChecklistItems ci ON ci.LinkedInspectionId = i.Id
                        WHERE 
                            (@ObjectId IS NULL OR i.ObjectId = @ObjectId)
                            AND (@DrawingFileId IS NULL OR o.DrawingFileId = @DrawingFileId)
                            AND (@Status IS NULL OR i.Status = @Status)
                            AND (
                                @Search IS NULL OR @Search = ''
                                OR o.Name LIKE '%' + @Search + '%'
                                OR i.SubmittedBy LIKE '%' + @Search + '%'
                                OR d.FileName LIKE '%' + @Search + '%'
                            )
                        GROUP BY 
                            i.Id, i.ObjectId, o.Name, o.DrawingFileId, d.FileName, o.PageNumber,
                            i.FormSchemaId, i.FormDataJson, i.Status, i.SubmittedById, i.SubmittedBy,
                            i.SubmittedAt, i.ReviewedById, i.ReviewedBy, i.ReviewedAt, i.ApprovedById,
                            i.ApprovedBy, i.ApprovedAt, i.RejectReason, i.CreatedAt, i.UpdatedAt
                    )
                    SELECT 
                        *,
                        COUNT(*) OVER() AS TotalCount
                    FROM FilteredData
                    ORDER BY CreatedAt DESC
                    OFFSET @Offset ROWS
                    FETCH NEXT @PageSize ROWS ONLY;
                END;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS sp_GetInspectionList;");
        }
    }
}
