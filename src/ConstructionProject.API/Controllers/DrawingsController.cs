using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Application.Features.Drawings.Commands;
using ConstructionProject.Application.Features.Drawings.Queries;
using ConstructionProject.Domain.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConstructionProject.API.Controllers;

public class UploadDrawingForm
{
    public IFormFile File { get; set; } = null!;
    public string? UploadedBy { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class DrawingsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IFileStorageService _fileStorage;
    private readonly ICurrentUserService _currentUserService;

    public DrawingsController(
        IMediator mediator, 
        IFileStorageService fileStorage,
        ICurrentUserService currentUserService)
    {
        _mediator = mediator;
        _fileStorage = fileStorage;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Upload bản vẽ xây dựng định dạng PDF (Chỉ cho phép Role Submitter; Admin và các role khác không được phép)
    /// </summary>
    [HttpPost("upload")]
    [Authorize(Roles = RoleConstants.Submitter)]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(DrawingFileDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UploadDrawing(
        [FromForm] UploadDrawingForm form,
        CancellationToken cancellationToken = default)
    {
        var file = form.File;
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Vui lòng chọn file PDF để upload." });
        }

        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Hệ thống chỉ chấp nhận upload bản vẽ định dạng PDF." });
        }

        var uploader = !string.IsNullOrWhiteSpace(form.UploadedBy) 
            ? form.UploadedBy 
            : (_currentUserService.Username ?? "Submitter");

        using var stream = file.OpenReadStream();
        var command = new UploadDrawingFileCommand(
            stream,
            file.FileName,
            file.ContentType,
            file.Length,
            uploader,
            _currentUserService.UserId
        );

        var result = await _mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetDrawingById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Lấy danh sách tất cả các bản vẽ đã upload (Chỉ cho phép Submitter, Reviewer, Approver; Admin không can thiệp)
    /// </summary>
    [HttpGet]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer},{RoleConstants.Approver}")]
    [ProducesResponseType(typeof(List<DrawingFileDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDrawings([FromQuery] string? search, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetDrawingFilesQuery(search), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lấy thông tin chi tiết một bản vẽ kèm danh sách các Object đã khoanh vùng
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer},{RoleConstants.Approver}")]
    [ProducesResponseType(typeof(DrawingFileDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDrawingById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetDrawingFileByIdQuery(id), cancellationToken);
        if (result == null)
        {
            return NotFound(new { message = $"Không tìm thấy bản vẽ với Id = {id}." });
        }
        return Ok(result);
    }

    /// <summary>
    /// Lấy thông tin chi tiết một bản vẽ theo tên file (chấp nhận cả tên file gốc hoặc StoredFileName)
    /// </summary>
    [HttpGet("by-name/{fileName}")]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer},{RoleConstants.Approver}")]
    [ProducesResponseType(typeof(DrawingFileDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDrawingByName(string fileName, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetDrawingFileByNameQuery(fileName), cancellationToken);
        if (result == null)
        {
            return NotFound(new { message = $"Không tìm thấy bản vẽ với tên file = '{fileName}'." });
        }
        return Ok(result);
    }

    /// <summary>
    /// Xóa một bản vẽ (Chỉ dành riêng cho Submitter; không thể xóa nếu đã có đơn nghiệm thu liên kết)
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = RoleConstants.Submitter)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteDrawing(Guid id, CancellationToken cancellationToken)
    {
        await _mediator.Send(new DeleteDrawingFileCommand(id), cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Tải / Xem trực tiếp file PDF bản vẽ (chấp nhận cả tên file gốc hoặc StoredFileName có Guid)
    /// </summary>
    [HttpGet("files/{fileName}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetDrawingFileStream(string fileName, CancellationToken cancellationToken)
    {
        // 1. Thử lấy trực tiếp từ FileStorage
        var fileData = await _fileStorage.GetFileAsync(fileName, cancellationToken);

        // 2. Nếu không tìm thấy trực tiếp, tra cứu DB để lấy fileUrl/StoredFileName chính xác
        if (fileData == null)
        {
            var drawing = await _mediator.Send(new GetDrawingFileByNameQuery(fileName), cancellationToken);
            if (drawing != null && !string.IsNullOrEmpty(drawing.FileUrl))
            {
                var storedName = Path.GetFileName(drawing.FileUrl);
                fileData = await _fileStorage.GetFileAsync(storedName, cancellationToken);
            }
        }

        if (fileData == null)
        {
            return NotFound(new { message = $"Không tìm thấy file bản vẽ '{fileName}' trên hệ thống lưu trữ." });
        }

        var ext = Path.GetExtension(fileData.Value.fileName);
        var baseName = Path.GetFileNameWithoutExtension(fileData.Value.fileName);
        var asciiSafeName = System.Text.RegularExpressions.Regex.Replace(baseName, @"[^\u0020-\u007E]", "_") + ext;
        var utf8EncodedName = Uri.EscapeDataString(fileData.Value.fileName);

        Response.Headers.Append("Content-Disposition", $"inline; filename=\"{asciiSafeName}\"; filename*=UTF-8''{utf8EncodedName}");
        return File(fileData.Value.stream, fileData.Value.contentType, enableRangeProcessing: true);
    }
}
