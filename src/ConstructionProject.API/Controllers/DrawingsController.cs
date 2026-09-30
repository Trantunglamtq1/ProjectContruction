using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Application.Features.Drawings.Commands;
using ConstructionProject.Application.Features.Drawings.Queries;
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
[Authorize]
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
    /// Upload bản vẽ xây dựng định dạng PDF (Yêu cầu Role Submitter hoặc Admin)
    /// </summary>
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(DrawingFileDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
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
    /// Lấy danh sách tất cả các bản vẽ đã upload
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<DrawingFileDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetDrawings(CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetDrawingFilesQuery(), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lấy thông tin chi tiết một bản vẽ kèm danh sách các Object đã khoanh vùng
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(DrawingFileDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
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
    /// Tải / Xem trực tiếp file PDF bản vẽ (dùng cho pdf.js Viewport)
    /// </summary>
    [HttpGet("files/{fileName}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetDrawingFileStream(string fileName, CancellationToken cancellationToken)
    {
        var fileData = await _fileStorage.GetFileAsync(fileName, cancellationToken);
        if (fileData == null)
        {
            return NotFound(new { message = "Không tìm thấy file bản vẽ trên hệ thống lưu trữ." });
        }

        Response.Headers.Append("Content-Disposition", $"inline; filename=\"{fileData.Value.fileName}\"");
        return File(fileData.Value.stream, fileData.Value.contentType, enableRangeProcessing: true);
    }
}
