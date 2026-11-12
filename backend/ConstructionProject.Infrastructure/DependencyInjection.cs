using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Infrastructure.Persistence;
using ConstructionProject.Infrastructure.Services;
using Elsa.Extensions;
using Elsa.EntityFrameworkCore.Extensions;
using Elsa.EntityFrameworkCore.Modules.Management;
using Elsa.EntityFrameworkCore.Modules.Runtime;
using ConstructionProject.Infrastructure.Workflows;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace ConstructionProject.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration, bool enableDurableChecklist = true)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? "Server=.\\SQLEXPRESS;Database=ConstructionProjectDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;";

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseSqlServer(connectionString, b =>
            {
                b.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
                b.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorNumbersToAdd: null);
            }));

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());
        
        var storageProvider = configuration["Storage:Provider"] ?? "MinIO";
        if (storageProvider.Equals("MinIO", StringComparison.OrdinalIgnoreCase))
        {
            services.AddScoped<IFileStorageService, MinioFileStorageService>();
        }
        else
        {
            services.AddScoped<IFileStorageService, LocalFileStorageService>();
        }
        
        services.AddHttpContextAccessor();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IEmailService, EmailService>();

        // Cấu hình Elsa Workflow 3.x Engine
        if (enableDurableChecklist)
        {
            services.AddElsa(elsa =>
            {
                elsa.UseWorkflowManagement(management => management.UseEntityFrameworkCore(ef => ef.UseSqlServer(connectionString)));
                elsa.UseWorkflowRuntime(runtime =>
                {
                    runtime.UseEntityFrameworkCore(ef => ef.UseSqlServer(connectionString));
                    runtime.AddWorkflow<ChecklistApprovalWorkflow>();
                });
            });
            services.AddScoped<IChecklistWorkflowReconciler, ChecklistWorkflowReconciler>();
            services.AddScoped<ChecklistWorkflowOperationProcessor>();
            services.AddHostedService<ChecklistWorkflowWorker>();
        }
        else services.AddElsa();
        services.AddScoped<IInspectionWorkflowService, InspectionWorkflowService>();
        services.AddScoped<SignalRNotificationService>();
        services.AddScoped<INotificationService>(provider => new BestEffortNotificationService(
            provider.GetRequiredService<SignalRNotificationService>(),
            provider.GetRequiredService<Microsoft.Extensions.Logging.ILogger<BestEffortNotificationService>>()));

        return services;
    }
}
