using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Application.Features.Checklists.Commands;
using ConstructionProject.Application.Features.Checklists.Queries;
using ConstructionProject.Domain.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConstructionProject.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChecklistsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ICurrentUserService _currentUserService;

    public ChecklistsController(IMediator mediator, ICurrentUserService currentUserService)
    {
        _mediator = mediator;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Tạo mới Kế hoạch Checklist cho cấu kiện Object (Kỹ sư / Submitter) — Giai đoạn 1 (Planning Phase)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = RoleConstants.Submitter)]
    [ProducesResponseType(typeof(ChecklistDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateChecklist(
        [FromBody] CreateChecklistRequest request, 
        CancellationToken cancellationToken)
    {
        var command = new CreateChecklistCommand(
            request.ObjectId,
            request.Name,
            request.Description,
            request.Items,
            _currentUserService.UserId,
            _currentUserService.Username ?? "Submitter"
        );

        var result = await _mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetChecklistById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Trình duyệt Kế hoạch Checklist lên Giám sát (Kích hoạt Elsa Workflow #1) — Giai đoạn 1 (Planning Phase)
    /// </summary>
    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = RoleConstants.Submitter)]
    [ProducesResponseType(typeof(ChecklistDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SubmitChecklist(Guid id, CancellationToken cancellationToken)
    {
        var command = new SubmitChecklistForApprovalCommand(
            id,
            _currentUserService.UserId,
            _currentUserService.Username ?? "Submitter"
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Giám sát thẩm định và Phê duyệt Kế hoạch Checklist (Khóa cứng Schema & Mở khóa tạo phiếu nghiệm thu)
    /// </summary>
    [HttpPost("{id:guid}/supervisor-approve")]
    [Authorize(Roles = RoleConstants.Reviewer)]
    [ProducesResponseType(typeof(ChecklistDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SupervisorApprove(
        Guid id, 
        [FromBody] SupervisorDecisionRequest request, 
        CancellationToken cancellationToken)
    {
        var command = new SupervisorApproveChecklistCommand(
            id,
            _currentUserService.UserId,
            _currentUserService.Username ?? "Supervisor",
            request.Comment
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Giám sát Từ chối Kế hoạch Checklist và yêu cầu Kỹ sư lập lại kèm lý do
    /// </summary>
    [HttpPost("{id:guid}/supervisor-reject")]
    [Authorize(Roles = RoleConstants.Reviewer)]
    [ProducesResponseType(typeof(ChecklistDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SupervisorReject(
        Guid id, 
        [FromBody] SupervisorDecisionRequest request, 
        CancellationToken cancellationToken)
    {
        var command = new SupervisorRejectChecklistCommand(
            id,
            request.RejectReason ?? request.Comment ?? string.Empty,
            _currentUserService.UserId,
            _currentUserService.Username ?? "Supervisor",
            request.Comment
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Giám sát can thiệp trực tiếp: Sửa/Thêm/Xóa tiêu chí & Sửa Form.io Schema khi đang chờ duyệt (FR-05)
    /// </summary>
    [HttpPut("{id:guid}/supervisor-modify")]
    [Authorize(Roles = RoleConstants.Reviewer)]
    [ProducesResponseType(typeof(ChecklistDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SupervisorModify(
        Guid id, 
        [FromBody] SupervisorModifyChecklistRequest request, 
        CancellationToken cancellationToken)
    {
        var command = new SupervisorModifyChecklistCommand(
            id,
            request.Name,
            request.Description,
            request.Items,
            _currentUserService.UserId,
            _currentUserService.Username ?? "Supervisor",
            request.Comment
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Thêm tiêu chí ChecklistItem (Kèm Form.io JSON Schema)
    /// </summary>
    [HttpPost("{id:guid}/items")]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer}")]
    [ProducesResponseType(typeof(ChecklistItemDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddItem(
        Guid id, 
        [FromBody] AddChecklistItemRequest request, 
        CancellationToken cancellationToken)
    {
        var command = new AddChecklistItemCommand(
            id,
            request.Name,
            request.OrderIndex,
            request.IsRequired,
            request.FormSchemaJson,
            _currentUserService.UserId,
            _currentUserService.Username,
            _currentUserService.Role
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Created($"/api/checklists/{id}/items/{result.Id}", result);
    }

    /// <summary>
    /// Cập nhật tiêu chí ChecklistItem (Tên, tính bắt buộc, Form.io JSON Schema)
    /// </summary>
    [HttpPut("{id:guid}/items/{itemId:guid}")]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer}")]
    [ProducesResponseType(typeof(ChecklistItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateItem(
        Guid id, 
        Guid itemId, 
        [FromBody] UpdateChecklistItemRequest request, 
        CancellationToken cancellationToken)
    {
        var command = new UpdateChecklistItemCommand(
            itemId,
            request.Name,
            request.OrderIndex,
            request.IsRequired,
            request.FormSchemaJson,
            _currentUserService.UserId,
            _currentUserService.Username,
            _currentUserService.Role
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Xóa mềm một tiêu chí ChecklistItem (Khóa xóa nếu đã có phiếu nghiệm thu phát sinh)
    /// </summary>
    [HttpDelete("{id:guid}/items/{itemId:guid}")]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteItem(
        Guid id, 
        Guid itemId, 
        CancellationToken cancellationToken)
    {
        var command = new DeleteChecklistItemCommand(
            itemId,
            _currentUserService.UserId,
            _currentUserService.Username,
            _currentUserService.Role
        );

        await _mediator.Send(command, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Liên kết phiếu nghiệm thu FormInspection vào tiêu chí (Chỉ cho phép khi Checklist đã Approved)
    /// </summary>
    [HttpPost("{id:guid}/items/{itemId:guid}/link-inspection")]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Reviewer}")]
    [ProducesResponseType(typeof(ChecklistItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> LinkInspection(
        Guid id, 
        Guid itemId, 
        [FromBody] LinkInspectionToChecklistItemRequest request, 
        CancellationToken cancellationToken)
    {
        var command = new LinkInspectionToChecklistItemCommand(
            id,
            itemId,
            request.InspectionId,
            _currentUserService.UserId,
            _currentUserService.Username,
            _currentUserService.Role
        );

        var result = await _mediator.Send(command, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Xóa mềm toàn bộ Kế hoạch Checklist (Khóa xóa nếu đã có phiếu nghiệm thu phát sinh)
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = $"{RoleConstants.Submitter},{RoleConstants.Admin}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteChecklist(Guid id, CancellationToken cancellationToken)
    {
        var command = new DeleteChecklistCommand(
            id,
            _currentUserService.UserId,
            _currentUserService.Username,
            _currentUserService.Role
        );

        await _mediator.Send(command, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Lấy danh sách Checklist (Hỗ trợ lọc theo objectId và trạng thái)
    /// </summary>
    [HttpGet]
    [Authorize]
    [ProducesResponseType(typeof(List<ChecklistDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetChecklists(
        [FromQuery] Guid? objectId, 
        [FromQuery] string? status, 
        CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetChecklistsQuery(objectId, status), cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Lấy chi tiết Kế hoạch Checklist kèm danh sách Items, Form.io Schema và Audit Trail
    /// </summary>
    [HttpGet("{id:guid}")]
    [Authorize]
    [ProducesResponseType(typeof(ChecklistDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetChecklistById(Guid id, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetChecklistByIdQuery(id), cancellationToken);
        if (result == null)
        {
            return NotFound(new { message = $"Không tìm thấy Checklist với Id = {id}." });
        }
        return Ok(result);
    }

    /// <summary>
    /// Thống kê tỷ lệ hoàn thành nghiệm thu Checklist theo Object cấu kiện
    /// </summary>
    [HttpGet("object/{objectId:guid}/summary")]
    [Authorize]
    [ProducesResponseType(typeof(ChecklistSummaryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetChecklistSummary(Guid objectId, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new GetChecklistSummaryByObjectQuery(objectId), cancellationToken);
        return Ok(result);
    }
}
