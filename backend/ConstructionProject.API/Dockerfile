# Stage 1: Build & Publish .NET Web API
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Sao chép file csproj để restore dependencies (tận dụng cache layer của Docker)
COPY backend/ConstructionProject.Domain/ConstructionProject.Domain.csproj backend/ConstructionProject.Domain/
COPY backend/ConstructionProject.Application/ConstructionProject.Application.csproj backend/ConstructionProject.Application/
COPY backend/ConstructionProject.Infrastructure/ConstructionProject.Infrastructure.csproj backend/ConstructionProject.Infrastructure/
COPY backend/ConstructionProject.API/ConstructionProject.API.csproj backend/ConstructionProject.API/

RUN dotnet restore backend/ConstructionProject.API/ConstructionProject.API.csproj

# Sao chép toàn bộ source code và build
COPY backend/ backend/
WORKDIR /app/backend/ConstructionProject.API
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime Image tối ưu
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5092
ENV ASPNETCORE_ENVIRONMENT=Development
EXPOSE 5092

ENTRYPOINT ["dotnet", "ConstructionProject.API.dll"]
