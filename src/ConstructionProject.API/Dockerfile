# Stage 1: Build & Publish .NET Web API
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Sao chép file csproj để restore dependencies (tận dụng cache layer của Docker)
COPY src/ConstructionProject.Domain/ConstructionProject.Domain.csproj src/ConstructionProject.Domain/
COPY src/ConstructionProject.Application/ConstructionProject.Application.csproj src/ConstructionProject.Application/
COPY src/ConstructionProject.Infrastructure/ConstructionProject.Infrastructure.csproj src/ConstructionProject.Infrastructure/
COPY src/ConstructionProject.API/ConstructionProject.API.csproj src/ConstructionProject.API/

RUN dotnet restore src/ConstructionProject.API/ConstructionProject.API.csproj

# Sao chép toàn bộ source code và build
COPY src/ src/
WORKDIR /app/src/ConstructionProject.API
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime Image tối ưu
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5092
ENV ASPNETCORE_ENVIRONMENT=Development
EXPOSE 5092

ENTRYPOINT ["dotnet", "ConstructionProject.API.dll"]
