using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using ConstructionProject.Infrastructure.Persistence;

namespace ConstructionProject.UnitTests.TestInfrastructure;

/// <summary>
/// Bộ dữ liệu mẫu tối thiểu: 1 bản vẽ → 1 cấu kiện → 1 checklist (2 tiêu chí bắt buộc)
/// → 1 phiếu nghiệm thu. Đủ để kiểm thử toàn bộ vòng đời trạng thái.
/// </summary>
public sealed class InspectionSeed
{
    public required DrawingFile Drawing { get; init; }
    public required ConstructionObject Object { get; init; }
    public required Checklist Checklist { get; init; }
    public required ChecklistItem LinkedItem { get; init; }
    public required ChecklistItem AlreadyDoneItem { get; init; }
    public required FormInspection Inspection { get; init; }

    public static InspectionSeed Create(
        ApplicationDbContext db,
        InspectionStatus status = InspectionStatus.Draft,
        string formDataJson = "{\"ketQua\":\"Dat\",\"ghiChu\":\"Dat yeu cau\"}")
    {
        var drawing = new DrawingFile
        {
            Id = Guid.NewGuid(),
            FileName = "ban-ve-tang-3.pdf",
            StoredFileName = "stored-ban-ve-tang-3.pdf",
            FileType = "pdf",
            FileUrl = "/uploads/stored-ban-ve-tang-3.pdf",
            FileSizeBytes = 1024,
            UploadedBy = "submitter",
            UploadedAt = DateTime.UtcNow
        };

        var constructionObject = new ConstructionObject
        {
            Id = Guid.NewGuid(),
            DrawingFileId = drawing.Id,
            DrawingFile = drawing,
            PageNumber = 1,
            MarkerCoordinates = "{\"x\":10,\"y\":20,\"width\":100,\"height\":50}",
            Name = "Cột C12 - Tầng 3",
            CreatedBy = "submitter",
            CreatedAt = DateTime.UtcNow
        };

        var checklist = new Checklist
        {
            Id = Guid.NewGuid(),
            ObjectId = constructionObject.Id,
            Object = constructionObject,
            Name = "Checklist nghiệm thu kết cấu",
            Status = ChecklistStatus.Approved,
            CreatedBy = "submitter",
            CreatedAt = DateTime.UtcNow
        };

        var inspection = new FormInspection
        {
            Id = Guid.NewGuid(),
            ObjectId = constructionObject.Id,
            Object = constructionObject,
            ChecklistId = checklist.Id,
            Checklist = checklist,
            FormSchemaId = "default-inspection-schema",
            FormDataJson = formDataJson,
            Status = status,
            RowVersion = new byte[8],
            SubmittedById = Guid.NewGuid(),
            SubmittedBy = "Kỹ sư hiện trường",
            SubmittedAt = status == InspectionStatus.Draft ? null : DateTime.UtcNow,
            WorkflowInstanceId = status == InspectionStatus.Draft ? null : "wf-test-001",
            CreatedAt = DateTime.UtcNow
        };

        var linkedItem = new ChecklistItem
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            Checklist = checklist,
            Name = "Kiểm tra cốt thép",
            OrderIndex = 0,
            IsRequired = true,
            FormSchemaJson = "{}",
            Status = ChecklistItemStatus.Pending,
            LinkedInspectionId = inspection.Id,
            LinkedInspection = inspection
        };

        var alreadyDoneItem = new ChecklistItem
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            Checklist = checklist,
            Name = "Kiểm tra coffa",
            OrderIndex = 1,
            IsRequired = true,
            FormSchemaJson = "{}",
            Status = ChecklistItemStatus.Done,
            LinkedInspectionId = inspection.Id,
            LinkedInspection = inspection
        };

        checklist.Items.Add(linkedItem);
        checklist.Items.Add(alreadyDoneItem);
        inspection.LinkedChecklistItems.Add(linkedItem);
        inspection.LinkedChecklistItems.Add(alreadyDoneItem);

        db.DrawingFiles.Add(drawing);
        db.Objects.Add(constructionObject);
        db.Checklists.Add(checklist);
        db.FormInspections.Add(inspection);
        db.ChecklistItems.AddRange(linkedItem, alreadyDoneItem);
        db.SaveChanges();

        return new InspectionSeed
        {
            Drawing = drawing,
            Object = constructionObject,
            Checklist = checklist,
            LinkedItem = linkedItem,
            AlreadyDoneItem = alreadyDoneItem,
            Inspection = inspection
        };
    }
}
