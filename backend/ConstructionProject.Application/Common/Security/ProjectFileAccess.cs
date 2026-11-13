using System.Text.Json;
using System.Text.Json.Nodes;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Common.Security;

public sealed class ProjectFileAccess(IApplicationDbContext db,IProjectAccessService access)
{
    public static string MimeType(string name) => Path.GetExtension(name).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf", ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg",
        ".webp" => "image/webp", ".heic" => "image/heic", _ => throw new InvalidOperationException("Định dạng tệp không được hỗ trợ.")
    };
    public static string AttachmentUrl(string name) => "/api/inspections/attachments/files/" + Uri.EscapeDataString(name);

    public async Task<DrawingFile> DrawingAsync(string name,Guid? projectId,CancellationToken ct)
    {
        ValidateName(name);
        await access.DemandIdentityAsync(ct);
        if (projectId.HasValue) await access.DemandProjectAsync(projectId.Value,ct);
        var matches = db.DrawingFiles.AsNoTracking().Where(d => d.StoredFileName == name || d.FileName == name);
        var drawing = await matches.Where(d => access.AccessibleProjectIds.Contains(d.ProjectId) && (!projectId.HasValue || d.ProjectId == projectId))
            .OrderByDescending(d => d.UploadedAt).FirstOrDefaultAsync(ct);
        if (drawing == null)
        {
            if (await matches.AnyAsync(ct)) throw new ProjectAccessDeniedException();
            throw new KeyNotFoundException("Không tìm thấy tệp bản vẽ.");
        }
        ValidateName(drawing.StoredFileName);
        return drawing;
    }

    public async Task<ProjectAttachment> AttachmentAsync(string name,CancellationToken ct)
    {
        ValidateName(name);
        var file = await db.ProjectAttachments.AsNoTracking().SingleOrDefaultAsync(a => a.StoredFileName == name,ct)
            ?? throw new KeyNotFoundException("Không tìm thấy tệp đính kèm.");
        await access.DemandProjectAsync(file.ProjectId,ct);
        return file;
    }

    public async Task<InspectionAttachmentDto> RegisterAsync(Guid projectId,Guid? userId,string name,string original,long size,CancellationToken ct)
    {
        await access.DemandProjectAsync(projectId,ct);
        ValidateName(name);
        var entity = new ProjectAttachment { ProjectId = projectId, UploadedById = userId, StoredFileName = name,
            OriginalName = Path.GetFileName(original), Size = size, ContentType = MimeType(name) };
        db.ProjectAttachments.Add(entity); await db.SaveChangesAsync(ct);
        return Dto(entity);
    }

    public async Task<string> NormalizeAsync(Guid projectId,string json,CancellationToken ct)
    {
        JsonObject data;
        try { data = JsonNode.Parse(json) as JsonObject ?? throw new JsonException(); }
        catch (JsonException) { throw new InvalidOperationException("Dữ liệu biểu mẫu không hợp lệ."); }
        if (!data.TryGetPropertyValue("attachments",out var node)) return json;
        if (node is not JsonArray attachments) throw new InvalidOperationException("Danh sách tệp đính kèm không hợp lệ.");
        var canonical = new JsonArray();
        foreach (var item in attachments)
        {
            if (item is not JsonObject obj || obj["storedFileName"] is not JsonValue stored || !stored.TryGetValue<string>(out var name) || string.IsNullOrWhiteSpace(name))
                throw new InvalidOperationException("Thiếu thông tin tệp đính kèm.");
            var file = await AttachmentAsync(name,ct);
            if (file.ProjectId != projectId) throw new InvalidOperationException("Tệp đính kèm phải thuộc cùng dự án với hồ sơ.");
            if (obj["fileUrl"] is JsonValue supplied && (!supplied.TryGetValue<string>(out var url) || url != AttachmentUrl(file.StoredFileName)))
                throw new InvalidOperationException("Đường dẫn tệp đính kèm không hợp lệ.");
            canonical.Add(JsonSerializer.SerializeToNode(Dto(file),new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        }
        data["attachments"] = canonical;
        return data.ToJsonString();
    }

    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > 512 || name.Contains('/') || name.Contains('\\') || name is "." or "..")
            throw new InvalidOperationException("Tên tệp không hợp lệ.");
    }
    private static InspectionAttachmentDto Dto(ProjectAttachment file) => new()
    {
        OriginalName = file.OriginalName, StoredFileName = file.StoredFileName, ContentType = MimeType(file.StoredFileName),
        FileUrl = AttachmentUrl(file.StoredFileName), Size = file.Size, UploadedAt = file.UploadedAt
    };
}
