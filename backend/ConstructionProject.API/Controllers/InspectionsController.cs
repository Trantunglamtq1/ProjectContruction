using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Application.Features.Inspections.Commands;
using ConstructionProject.Application.Features.Inspections.Queries;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConstructionProject.API.Controllers;

public record CreateInspectionRequest(
    Guid ChecklistId,
    Guid ChecklistItemId,
    Guid? ObjectId = null,
    string? FormDataJson = null,
    bool SubmitImmediately = false
);

public record UpdateInspectionDraftRequest(
    string FormDataJson
);

public record SubmitInspectionRequest(
    string? FormDataJson
);

public record WorkflowActionRequest(
    string? Comment = null,
    string? Notes = null
)
{
    public string? GetEffectiveComment() =>
        !string.IsNullOrWhiteSpace(Comment) ? Comment : (!string.IsNullOrWhiteSpace(Notes) ? Notes : null);
}

public record RejectInspectionRequest(
    string? Reason = null,
    string? Comment = null,
    string? Notes = null
)
{
    public string GetEffectiveReason() =>
        !string.IsNullOrWhiteSpace(Reason) ? Reason : (!string.IsNullOrWhiteSpace(Comment) ? Comment : (!string.IsNullOrWhiteSpace(Notes) ? Notes : string.Empty));
}

[ApiController]
[Route("api/[controller]")]
public class InspectionsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUserService;
    private readonly IFileStorageService _fileStorage;

    public InspectionsController(
        IMediator mediator, 
        ICurrentUserService currentUserService,
        IFileStorageService fileStorage)
    {
        _mediator = mediator;
        _currentUserService = currentUserService;
        _fileStorage = fileStorage;
    }

    /// <summary>
    /// Điền/Khởi tạo phiếu nghiệm thu cho một tiêu chí trong Checklist (Chỉ Submitter)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = RoleConstants.Submitter)]
    [ProducesResponseType(typeof(InspectionDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CreateInspection(
        [FromBody] CreateInspectionRequest request,
        CancellationToken cancellationToken)
    {
        var command = new CreateInspectionCommand(
            request.ChecklistId,
            request.ChecklistItemId,
            request.ObjectId,
            request.FormDataJson,
            request.SubmitImmediately,
            _currentUserService.UserId,
            _currentUserService.FullName ?? _currentUserService.Username
        );

        var result = await _mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetInspectionById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Chỉnh sửa nội dung bản nháp Draft (Chỉ Submitter đã tạo)
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = RoleConstants.Submitter)]
    [ProducesResponseType(typeof(InspectionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateInspectionDraft(
        Guid id,
        [FromBody] UpdateInspectionDraftRequest request,
        CancellationToken cancellationToken)
    {
        var command = new UpdateInspectionDraftCommand(
            id,
            request.FormDataJson,
            _currentUserService.UserId
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Nộp đơn kiểm tra (Draft -> Submitted) để chuyển sang luồng thẩm tra (Chỉ Submitter)
    /// </summary>
    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = RoleConstants.Submitter)]
    [ProducesResponseType(typeof(InspectionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitInspection(
        Guid id,
        [FromBody] SubmitInspectionRequest? request,
        CancellationToken cancellationToken)
    {
        var command = new SubmitInspectionCommand(
            id,
            request?.FormDataJson,
            _currentUserService.UserId,
            _currentUserService.FullName ?? _currentUserService.Username
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Xóa một bản nháp Draft (Chỉ Submitter hoặc Admin)
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = RoleConstants.Submitter)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteInspection(
        Guid id,
        CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteInspectionCommand(id, _currentUserService.UserId), cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Lấy danh sách Inspection có hỗ trợ bộ lọc và phân trang (Submitter, Reviewer, Approver)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer},{RoleConstants.Approver}")]
    [ProducesResponseType(typeof(PaginatedResult<InspectionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInspections(
        [FromQuery] Guid? objectId,
        [FromQuery] Guid? drawingFileId,
        [FromQuery] Guid? checklistId,
        [FromQuery] Guid? checklistItemId,
        [FromQuery] InspectionStatus? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken cancellationToken = default)
    {
        var query = new GetInspectionsQuery(
            objectId,
            drawingFileId,
            checklistId,
            checklistItemId,
            status,
            search,
            page,
            pageSize
        );

        var result = await _mediator.Send(query, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lấy chi tiết một Form Inspection theo Id (Submitter, Reviewer, Approver)
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer},{RoleConstants.Approver}")]
    [ProducesResponseType(typeof(InspectionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetInspectionById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetInspectionByIdQuery(id), cancellationToken);
        if (result == null)
        {
            return NotFound(new { message = $"Không tìm thấy Form Inspection với Id = {id}." });
        }

        return Ok(result);
    }

    /// <summary>
    /// Reviewer tiếp nhận hồ sơ để thẩm tra hiện trường (Submitted -> UnderReview)
    /// </summary>
    [HttpPost("{id:guid}/receive")]
    [Authorize(Roles = RoleConstants.Reviewer)]
    [ProducesResponseType(typeof(InspectionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReceiveInspection(
        Guid id,
        [FromBody] WorkflowActionRequest? request,
        CancellationToken cancellationToken)
    {
        var command = new ReceiveInspectionCommand(
            id,
            _currentUserService.UserId,
            _currentUserService.FullName ?? _currentUserService.Username,
            request?.Comment
        );
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Reviewer thẩm tra đạt kỹ thuật - Phê duyệt Cấp 1 (Submitted/UnderReview -> Reviewed)
    /// </summary>
    [HttpPost("{id:guid}/review")]
    [HttpPost("{id:guid}/review-pass")]
    [Authorize(Roles = RoleConstants.Reviewer)]
    [ProducesResponseType(typeof(InspectionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ReviewInspection(
        Guid id,
        [FromBody] WorkflowActionRequest? request,
        CancellationToken cancellationToken)
    {
        var command = new ReviewInspectionCommand(
            id,
            _currentUserService.UserId,
            _currentUserService.FullName ?? _currentUserService.Username,
            request?.GetEffectiveComment()
        );
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Approver (Chủ đầu tư/Quản lý) Phê duyệt Nghiệm thu chính thức Cấp 2 (Reviewed -> Approved)
    /// Tự động chuyển toàn bộ ChecklistItem liên kết sang Done!
    /// </summary>
    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = RoleConstants.Approver)]
    [ProducesResponseType(typeof(InspectionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ApproveInspection(
        Guid id,
        [FromBody] WorkflowActionRequest? request,
        CancellationToken cancellationToken)
    {
        var command = new ApproveInspectionCommand(
            id,
            _currentUserService.UserId,
            _currentUserService.FullName ?? _currentUserService.Username,
            request?.GetEffectiveComment()
        );
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Reviewer hoặc Approver Từ chối hồ sơ kèm lý do bắt buộc (-> Rejected)
    /// </summary>
    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = $"{RoleConstants.Reviewer},{RoleConstants.Approver}")]
    [ProducesResponseType(typeof(InspectionDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RejectInspection(
        Guid id,
        [FromBody] RejectInspectionRequest request,
        CancellationToken cancellationToken)
    {
        var reason = request?.GetEffectiveReason() ?? string.Empty;
        var command = new RejectInspectionCommand(
            id,
            reason,
            _currentUserService.UserId,
            _currentUserService.FullName ?? _currentUserService.Username,
            _currentUserService.Role
        );
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lấy toàn bộ lịch sử luồng duyệt và vết chuyển đổi trạng thái của hồ sơ (Audit Trail)
    /// </summary>
    [HttpGet("{id:guid}/history")]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer},{RoleConstants.Approver}")]
    [ProducesResponseType(typeof(List<InspectionAuditHistoryDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInspectionHistory(
        Guid id,
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetInspectionHistoryQuery(id), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lấy danh sách các mẫu schema biểu mẫu kiểm tra FormIO có sẵn
    /// </summary>
    [HttpGet("schemas")]
    [Authorize]
    [ProducesResponseType(typeof(List<FormSchemaItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInspectionSchemas(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetInspectionSchemasQuery(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lấy schema JSON FormIO dùng để render giao diện form kiểm tra
    /// </summary>
    [HttpGet("schema/{schemaId?}")]
    [HttpGet("schemas/{schemaId}")]
    [Authorize]
    [Produces("application/json")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInspectionSchema(
        string? schemaId = null,
        CancellationToken cancellationToken = default)
    {
        var jsonContent = await _mediator.Send(new GetInspectionSchemaQuery(schemaId ?? "default-inspection-schema"), cancellationToken);
        return Content(jsonContent, "application/json");
    }

    /// <summary>
    /// Upload ảnh hiện trường hoặc tài liệu đính kèm cho Form Inspection (Tối đa 15MB/tệp, hỗ trợ JPG, PNG, WEBP, HEIC, PDF)
    /// </summary>
    [HttpPost("upload-attachment")]
    [Authorize]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(InspectionAttachmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UploadAttachment(
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Vui lòng chọn tệp ảnh hiện trường để tải lên." });
        }

        const long maxFileSize = 15 * 1024 * 1024; // 15MB
        if (file.Length > maxFileSize)
        {
            return BadRequest(new { message = "Dung lượng tệp vượt quá giới hạn cho phép (Tối đa 15MB)." });
        }

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp", ".heic", ".pdf" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
        {
            return BadRequest(new { message = $"Định dạng tệp '{ext}' không được hỗ trợ. Vui lòng chọn tệp ảnh (.jpg, .jpeg, .png, .webp, .heic) hoặc .pdf." });
        }

        await using var stream = file.OpenReadStream();
        var (fileUrl, storedFileName, size) = await _fileStorage.SaveFileAsync(
            stream, 
            file.FileName, 
            file.ContentType, 
            cancellationToken);

        var viewUrl = $"/api/inspections/attachments/files/{storedFileName}";

        var attachment = new InspectionAttachmentDto
        {
            OriginalName = file.FileName,
            StoredFileName = storedFileName,
            FileUrl = viewUrl,
            Size = size,
            ContentType = file.ContentType,
            UploadedAt = DateTime.UtcNow
        };

        return Ok(attachment);
    }

    /// <summary>
    /// Tải / Xem trực tiếp tệp ảnh hiện trường đính kèm
    /// </summary>
    [HttpGet("attachments/files/{fileName}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAttachmentFileStream(
        string fileName, 
        CancellationToken cancellationToken)
    {
        var fileData = await _fileStorage.GetFileAsync(fileName, cancellationToken);
        if (fileData == null)
        {
            return NotFound(new { message = $"Không tìm thấy tệp đính kèm '{fileName}' trên hệ thống lưu trữ." });
        }

        var ext = Path.GetExtension(fileData.Value.fileName).ToLowerInvariant();
        var baseName = Path.GetFileNameWithoutExtension(fileData.Value.fileName);
        var asciiSafeName = System.Text.RegularExpressions.Regex.Replace(baseName, @"[^\u0020-\u007E]", "_") + ext;
        var utf8EncodedName = Uri.EscapeDataString(fileData.Value.fileName);

        var contentType = fileData.Value.contentType;
        if (string.IsNullOrWhiteSpace(contentType) || contentType == "application/octet-stream")
        {
            contentType = ext switch
            {
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".webp" => "image/webp",
                ".heic" => "image/heic",
                ".pdf" => "application/pdf",
                _ => "application/octet-stream"
            };
        }

        Response.Headers.Append("Content-Disposition", $"inline; filename=\"{asciiSafeName}\"; filename*=UTF-8''{utf8EncodedName}");
        return File(fileData.Value.stream, contentType, enableRangeProcessing: true);
    }
}
