using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Application.Features.Objects.Commands;
using ConstructionProject.Application.Features.Objects.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConstructionProject.API.Controllers;

public record CreateObjectRequest(
    Guid DrawingFileId,
    int PageNumber,
    string MarkerCoordinates,
    string Name,
    string? CreatedBy
);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ObjectsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUserService;

    public ObjectsController(IMediator mediator, ICurrentUserService currentUserService)
    {
        _mediator = mediator;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Tạo mới một Object từ vùng khoanh marker trên Viewport bản vẽ
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ObjectDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> CreateObject(
        [FromBody] CreateObjectRequest request, 
        CancellationToken cancellationToken)
    {
        var creator = !string.IsNullOrWhiteSpace(request.CreatedBy) 
            ? request.CreatedBy 
            : (_currentUserService.Username ?? "Submitter");

        var command = new CreateObjectFromMarkerCommand(
            request.DrawingFileId,
            request.PageNumber,
            request.MarkerCoordinates,
            request.Name,
            creator,
            _currentUserService.UserId
        );

        var result = await _mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetObjectById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Lấy danh sách Object (hỗ trợ lọc theo DrawingFileId)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<ObjectDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetObjects(
        [FromQuery] Guid? drawingFileId, 
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetObjectsQuery(drawingFileId), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lấy thông tin chi tiết của một Object theo Id
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ObjectDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetObjectById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetObjectByIdQuery(id), cancellationToken);
        if (result == null)
        {
            return NotFound(new { message = $"Không tìm thấy Object với Id = {id}." });
        }
        return Ok(result);
    }
}
