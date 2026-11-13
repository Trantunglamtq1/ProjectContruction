using System.Net.Http.Headers;
using System.Text.RegularExpressions;
using ConstructionProject.Application.Common.Security;
using Microsoft.AspNetCore.Mvc;

namespace ConstructionProject.API.Helpers;

internal static class PrivateFileResponse
{
    public static IActionResult Create(ControllerBase controller,Stream stream,string storedName,string originalName)
    {
        var safeName = originalName.Replace('\r','_').Replace('\n','_');
        var disposition = new ContentDispositionHeaderValue("inline")
        {
            FileName = Regex.Replace(safeName,@"[^\u0020-\u007E]","_"), FileNameStar = safeName
        };
        controller.Response.Headers.ContentDisposition = disposition.ToString();
        controller.Response.Headers.CacheControl = "private, no-store";
        controller.Response.Headers["X-Content-Type-Options"] = "nosniff";
        return controller.File(stream,ProjectFileAccess.MimeType(storedName),enableRangeProcessing: true);
    }
}
