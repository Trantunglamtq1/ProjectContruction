using ConstructionProject.Application.Features.Projects;
using ConstructionProject.Domain.Constants;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConstructionProject.API.Controllers;

[ApiController,Route("api/projects"),Authorize]
public class ProjectsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await mediator.Send(new GetProjectsQuery(),ct));
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Detail(Guid id,CancellationToken ct) => Ok(await mediator.Send(new GetProjectQuery(id),ct));
    [HttpPost,Authorize(Roles = RoleConstants.Admin)]
    public async Task<IActionResult> Create(CreateProjectCommand request,CancellationToken ct)
    {
        var result = await mediator.Send(request,ct);
        return CreatedAtAction(nameof(Detail),new { id = result.Id },result);
    }
    [HttpGet("{id:guid}/members"),Authorize(Roles = RoleConstants.Admin)]
    public async Task<IActionResult> Members(Guid id,CancellationToken ct) => Ok(await mediator.Send(new GetProjectMembersQuery(id),ct));
    [HttpPut("{id:guid}/members/{userId:guid}"),Authorize(Roles = RoleConstants.Admin)]
    public async Task<IActionResult> Assign(Guid id,Guid userId,CancellationToken ct) => Ok(await mediator.Send(new AssignProjectMemberCommand(id,userId),ct));
    [HttpDelete("{id:guid}/members/{userId:guid}"),Authorize(Roles = RoleConstants.Admin)]
    public async Task<IActionResult> Revoke(Guid id,Guid userId,CancellationToken ct)
    {
        await mediator.Send(new RevokeProjectMemberCommand(id,userId),ct);
        return NoContent();
    }
}
