using ConstructionProject.Application.Common.Security;
using ConstructionProject.API.Helpers;
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
    string FormDataJson,
    byte[]? RowVersion
);

public record SubmitInspectionRequest(
    string? FormDataJson,
    byte[]? RowVersion
);

public record DeleteInspectionRequest(byte[]? RowVersion);

public record WorkflowActionRequest(
    string? Comment = null,
    string? Notes = null,
    byte[]? RowVersion = null
)
{
    public string? GetEffectiveComment() =>
        !string.IsNullOrWhiteSpace(Comment) ? Comment : (!string.IsNullOrWhiteSpace(Notes) ? Notes : null);
}

public record RejectInspectionRequest(
    string? Reason = null,
    string? Comment = null,
    string? Notes = null,
    byte[]? RowVersion = null
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
    private readonly ProjectFileAccess _projectFiles;
    private readonly IProjectAccessService _projectAccess;
    private readonly ICurrentUserService _currentUserService;
    private readonly IFileStorageService _fileStorage;

    public InspectionsController(
        IMediator mediator, 
        ICurrentUserService currentUserService,
        IFileStorageService fileStorage, ProjectFileAccess projectFiles, IProjectAccessService projectAccess)
    {
        _mediator = mediator;
        _projectFiles = projectFiles;
        _projectAccess = projectAccess;
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
            _currentUserService.UserId,
            request.RowVersion
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
            _currentUserService.FullName ?? _currentUserService.Username,
            request?.RowVersion
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Accepted(result);
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
        [FromBody] DeleteInspectionRequest request,
        CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteInspectionCommand(id, _currentUserService.UserId, request.RowVersion), cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Lấy danh sách Inspection có hỗ trợ bộ lọc và phân trang (Submitter, Reviewer, Approver)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer},{RoleConstants.Approver}")]
    [ProducesResponseType(typeof(InspectionListResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetInspections(
        [FromQuery] Guid? objectId,
        [FromQuery] Guid? drawingFileId,
        [FromQuery] Guid? checklistId,
        [FromQuery] Guid? checklistItemId,
        [FromQuery] InspectionStatus? status,
        [FromQuery] string? search,
        [FromQuery] Guid? projectId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] int? pageNumber = null,
        CancellationToken cancellationToken = default)
    {
        var query = new GetInspectionsQuery(
            objectId,
            drawingFileId,
            checklistId,
            checklistItemId,
            status,
            search,
            pageNumber ?? page,
            pageSize,
            projectId
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
            request?.Comment,
            request?.RowVersion
        );
        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Reviewer thẩm tra đạt kỹ thuật - Phê duyệt Cấp 1 (UnderReview -> Reviewed)
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
            request?.GetEffectiveComment(),
            request?.RowVersion
        );
        var result = await _mediator.Send(command, cancellationToken);
        return Accepted(result);
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
            request?.GetEffectiveComment(),
            request?.RowVersion
        );
        var result = await _mediator.Send(command, cancellationToken);
        return Accepted(result);
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
            _currentUserService.Role,
            request?.RowVersion
        );
        var result = await _mediator.Send(command, cancellationToken);
        return Accepted(result);
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
    [Authorize(Roles = RoleConstants.Submitter)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(InspectionAttachmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UploadAttachment(IFormFile file,[FromForm] Guid projectId,CancellationToken cancellationToken)
    {
        if (projectId == Guid.Empty) return BadRequest(new { message = "Vui lòng chọn dự án." });
        await _projectAccess.DemandProjectAsync(projectId,cancellationToken);
        if (file == null || file.Length == 0) return BadRequest(new { message = "Vui lòng chọn tệp đính kèm." });
        if (file.Length > 15 * 1024 * 1024) return BadRequest(new { message = "Dung lượng tối đa là 15MB mỗi tệp." });
        if (file.FileName.Length > 512) return BadRequest(new { message = "Tên tệp quá dài." });
        var mime = ProjectFileAccess.MimeType(file.FileName);
        await using var stream = file.OpenReadStream();
        var (_,stored,size) = await _fileStorage.SaveFileAsync(stream,file.FileName,mime,cancellationToken);
        return Ok(await _projectFiles.RegisterAsync(projectId,_currentUserService.UserId,stored,file.FileName,size,cancellationToken));
    }

    /// <summary>
    /// Tải / Xem trực tiếp tệp ảnh hiện trường đính kèm
    /// </summary>
    [HttpGet("attachments/files/{fileName}")]
    [Authorize]
    public async Task<IActionResult> GetAttachmentFileStream(string fileName,CancellationToken cancellationToken)
    {
        var attachment = await _projectFiles.AttachmentAsync(fileName,cancellationToken);
        var file = await _fileStorage.GetFileAsync(attachment.StoredFileName,cancellationToken)
            ?? throw new KeyNotFoundException("Không tìm thấy nội dung tệp đính kèm.");
        return PrivateFileResponse.Create(this,file.stream,attachment.StoredFileName,attachment.OriginalName);
    }
}
