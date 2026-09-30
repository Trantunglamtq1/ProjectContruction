using ConstructionProject.Domain.Entities;

namespace ConstructionProject.Application.Common.Interfaces;

public interface IJwtTokenGenerator
{
    (string token, DateTime expiresAt) GenerateToken(User user, string? roleName);
}

public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}

public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Username { get; }
    string? Email { get; }
    string? Role { get; }
    bool IsAuthenticated { get; }
}
