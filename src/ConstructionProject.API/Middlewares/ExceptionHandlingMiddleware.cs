using System.Net;
using System.Text.Json;
using FluentValidation;

namespace ConstructionProject.API.Middlewares;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var statusCode = HttpStatusCode.InternalServerError;
        object response;

        switch (exception)
        {
            case ValidationException validationException:
                statusCode = HttpStatusCode.BadRequest;
                response = new
                {
                    status = (int)statusCode,
                    message = "Dữ liệu không hợp lệ.",
                    errors = validationException.Errors.Select(e => new { e.PropertyName, e.ErrorMessage })
                };
                break;

            case KeyNotFoundException keyNotFound:
                statusCode = HttpStatusCode.NotFound;
                response = new
                {
                    status = (int)statusCode,
                    message = keyNotFound.Message
                };
                break;

            case InvalidOperationException invalidOp:
                statusCode = HttpStatusCode.BadRequest;
                response = new
                {
                    status = (int)statusCode,
                    message = invalidOp.Message
                };
                break;

            default:
                statusCode = HttpStatusCode.InternalServerError;
                response = new
                {
                    status = (int)statusCode,
                    message = "Đã xảy ra lỗi máy chủ nội bộ.",
                    details = exception.Message
                };
                break;
        }

        context.Response.StatusCode = (int)statusCode;
        await context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
