using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace ConstructionProject.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
            cfg.AddOpenBehavior(typeof(ConstructionProject.Application.Common.Behaviors.ValidationBehavior<,>));
        });

        return services;
    }
}
