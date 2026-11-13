using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Features.Checklists.Commands;
using ConstructionProject.Application.Features.Checklists.Queries;
using ConstructionProject.Application.Features.Drawings.Commands;
using ConstructionProject.Application.Features.Drawings.Queries;
using ConstructionProject.Application.Features.Inspections.Commands;
using ConstructionProject.Application.Features.Inspections.Queries;
using ConstructionProject.Application.Features.Objects.Commands;
using ConstructionProject.Application.Features.Objects.Queries;
using ConstructionProject.Application.Features.Users;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Common.Security;

public static class ProjectRequestAuthorization
{
    private static readonly HashSet<Type> Supported =
    [
        typeof(UploadDrawingFileCommand), typeof(DeleteDrawingFileCommand), typeof(GetDrawingFilesQuery), typeof(GetDrawingFileByIdQuery), typeof(GetDrawingFileByNameQuery),
        typeof(CreateObjectFromMarkerCommand), typeof(DeleteObjectCommand), typeof(GetObjectsQuery), typeof(GetObjectByIdQuery),
        typeof(CreateChecklistCommand), typeof(DeleteChecklistCommand), typeof(SubmitChecklistForApprovalCommand), typeof(SupervisorApproveChecklistCommand),
        typeof(SupervisorRejectChecklistCommand), typeof(SupervisorModifyChecklistCommand), typeof(AddChecklistItemCommand), typeof(UpdateChecklistItemCommand),
        typeof(DeleteChecklistItemCommand), typeof(LinkInspectionToChecklistItemCommand), typeof(GetChecklistsQuery), typeof(GetChecklistByIdQuery), typeof(GetChecklistSummaryByObjectQuery),
        typeof(CreateInspectionCommand), typeof(UpdateInspectionDraftCommand), typeof(SubmitInspectionCommand), typeof(DeleteInspectionCommand),
        typeof(ReceiveInspectionCommand), typeof(ReviewInspectionCommand), typeof(ReviewPassInspectionCommand), typeof(ApproveInspectionCommand), typeof(RejectInspectionCommand),
        typeof(GetInspectionsQuery), typeof(GetInspectionByIdQuery), typeof(GetInspectionHistoryQuery), typeof(GetInspectionSchemaQuery), typeof(GetInspectionSchemasQuery)
    ];
    public static bool Supports(Type type) => Supported.Contains(type);
    public static bool IsProtected(Type type) => type.Namespace != null && new[]
    {
        "ConstructionProject.Application.Features.Drawings.", "ConstructionProject.Application.Features.Objects.",
        "ConstructionProject.Application.Features.Checklists.", "ConstructionProject.Application.Features.Inspections."
    }.Any(type.Namespace.StartsWith);

    public static IEnumerable<ProjectResource> Resources(object request) => request switch
    {
        UploadDrawingFileCommand x => [new(ProjectResourceKind.Project,x.ProjectId)],
        DeleteDrawingFileCommand x => [new(ProjectResourceKind.Drawing,x.Id)],
        GetDrawingFileByIdQuery x => [new(ProjectResourceKind.Drawing,x.Id)],
        GetDrawingFilesQuery x => Optional(ProjectResourceKind.Project,x.ProjectId),
        GetDrawingFileByNameQuery x => Optional(ProjectResourceKind.Project,x.ProjectId),
        CreateObjectFromMarkerCommand x => [new(ProjectResourceKind.Drawing,x.DrawingFileId)],
        DeleteObjectCommand x => [new(ProjectResourceKind.Object,x.Id)],
        GetObjectByIdQuery x => [new(ProjectResourceKind.Object,x.Id)],
        GetObjectsQuery x => Optional(ProjectResourceKind.Drawing,x.DrawingFileId).Concat(Optional(ProjectResourceKind.Project,x.ProjectId)),
        CreateChecklistCommand x => [new(ProjectResourceKind.Object,x.ObjectId)],
        DeleteChecklistCommand x => [new(ProjectResourceKind.Checklist,x.Id)],
        SubmitChecklistForApprovalCommand x => [new(ProjectResourceKind.Checklist,x.Id)],
        SupervisorApproveChecklistCommand x => [new(ProjectResourceKind.Checklist,x.Id)],
        SupervisorRejectChecklistCommand x => [new(ProjectResourceKind.Checklist,x.Id)],
        SupervisorModifyChecklistCommand x => new[] { new ProjectResource(ProjectResourceKind.Checklist,x.Id) }
            .Concat(x.Items?.Where(i => i.Id.HasValue).Select(i => new ProjectResource(ProjectResourceKind.ChecklistItem,i.Id!.Value)) ?? []),
        AddChecklistItemCommand x => [new(ProjectResourceKind.Checklist,x.ChecklistId)],
        UpdateChecklistItemCommand x => new[] { new ProjectResource(ProjectResourceKind.ChecklistItem,x.Id), new(ProjectResourceKind.Checklist,x.ChecklistId) },
        DeleteChecklistItemCommand x => new[] { new ProjectResource(ProjectResourceKind.ChecklistItem,x.Id), new(ProjectResourceKind.Checklist,x.ChecklistId) },
        LinkInspectionToChecklistItemCommand x => [new(ProjectResourceKind.Checklist,x.ChecklistId),new(ProjectResourceKind.ChecklistItem,x.ItemId),new(ProjectResourceKind.Inspection,x.InspectionId)],
        GetChecklistsQuery x => Optional(ProjectResourceKind.Object,x.ObjectId).Concat(Optional(ProjectResourceKind.Project,x.ProjectId)),
        GetChecklistByIdQuery x => [new(ProjectResourceKind.Checklist,x.Id)],
        GetChecklistSummaryByObjectQuery x => [new(ProjectResourceKind.Object,x.ObjectId)],
        CreateInspectionCommand x => new[] { new ProjectResource(ProjectResourceKind.Checklist,x.ChecklistId),new(ProjectResourceKind.ChecklistItem,x.ChecklistItemId) }.Concat(Optional(ProjectResourceKind.Object,x.ObjectId)),
        UpdateInspectionDraftCommand x => [new(ProjectResourceKind.Inspection,x.Id)],
        SubmitInspectionCommand x => [new(ProjectResourceKind.Inspection,x.Id)],
        DeleteInspectionCommand x => [new(ProjectResourceKind.Inspection,x.Id)],
        ReceiveInspectionCommand x => [new(ProjectResourceKind.Inspection,x.Id)],
        ReviewInspectionCommand x => [new(ProjectResourceKind.Inspection,x.Id)],
        ReviewPassInspectionCommand x => [new(ProjectResourceKind.Inspection,x.Id)],
        ApproveInspectionCommand x => [new(ProjectResourceKind.Inspection,x.Id)],
        RejectInspectionCommand x => [new(ProjectResourceKind.Inspection,x.Id)],
        GetInspectionByIdQuery x => [new(ProjectResourceKind.Inspection,x.Id)],
        GetInspectionHistoryQuery x => [new(ProjectResourceKind.Inspection,x.InspectionId)],
        GetInspectionsQuery x => Optional(ProjectResourceKind.Project,x.ProjectId).Concat(Optional(ProjectResourceKind.Drawing,x.DrawingFileId))
            .Concat(Optional(ProjectResourceKind.Object,x.ObjectId)).Concat(Optional(ProjectResourceKind.Checklist,x.ChecklistId)).Concat(Optional(ProjectResourceKind.ChecklistItem,x.ChecklistItemId)),
        GetInspectionSchemaQuery x when Guid.TryParse(x.SchemaId,out var id) => [new(ProjectResourceKind.ChecklistItem,id)],
        GetInspectionSchemaQuery or GetInspectionSchemasQuery => [],
        _ => throw new ProjectAccessDeniedException("Phạm vi yêu cầu chưa được hỗ trợ.")
    };
    private static IEnumerable<ProjectResource> Optional(ProjectResourceKind kind, Guid? id) => id.HasValue ? [new(kind,id.Value)] : [];
}

public sealed class ProjectAuthorizationBehavior<TRequest,TResponse>(IProjectAccessService access,ProjectFileAccess files,IApplicationDbContext db) : IPipelineBehavior<TRequest,TResponse> where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        // A demoted Admin must not restore their own global bypass with an old JWT.
        if (typeof(TRequest).Namespace == "ConstructionProject.Application.Features.Users" && request is not GetCurrentUserQuery)
            await access.DemandAdminAsync(cancellationToken);
        if (!ProjectRequestAuthorization.IsProtected(typeof(TRequest))) return await next();
        if (!ProjectRequestAuthorization.Supports(typeof(TRequest))) throw new ProjectAccessDeniedException();
        await access.DemandIdentityAsync(cancellationToken);
        Guid? project = null;
        foreach (var resource in ProjectRequestAuthorization.Resources(request).Distinct())
        {
            var resolved = await access.DemandAsync(resource,cancellationToken);
            if (project.HasValue && project.Value != resolved) throw new InvalidOperationException("Các tài nguyên phải thuộc cùng một dự án.");
            project = resolved;
        }
        if (project.HasValue)
        {
            switch (request)
            {
                case CreateInspectionCommand create:
                    create.FormDataJson = await files.NormalizeAsync(project.Value,create.FormDataJson ?? "{}",cancellationToken);
                    break;
                case UpdateInspectionDraftCommand update:
                    update.FormDataJson = await files.NormalizeAsync(project.Value,update.FormDataJson,cancellationToken);
                    break;
                case SubmitInspectionCommand submit:
                    var json = submit.FormDataJson ?? await db.FormInspections.Where(i => i.Id == submit.Id).Select(i => i.FormDataJson).SingleAsync(cancellationToken);
                    submit.FormDataJson = await files.NormalizeAsync(project.Value,json,cancellationToken);
                    break;
            }
        }
        return await next();
    }
}
