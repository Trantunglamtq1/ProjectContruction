using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Auth.Commands;

public record LoginCommand(
    string UsernameOrEmail,
    string Password
) : IRequest<AuthResponseDto>;

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.UsernameOrEmail)
            .NotEmpty().WithMessage("Vui lòng nhập tên đăng nhập hoặc email.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Vui lòng nhập mật khẩu.");
    }
}

public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResponseDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;

    public LoginCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher passwordHasher,
        IJwtTokenGenerator jwtTokenGenerator)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtTokenGenerator = jwtTokenGenerator;
    }

    public async Task<AuthResponseDto> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var input = request.UsernameOrEmail.Trim().ToLowerInvariant();

        // 1. Ưu tiên tìm chính xác theo Username (duy nhất)
        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Username.ToLower() == input, cancellationToken);

        // 2. Nếu không tìm thấy theo Username, thử tìm theo Email
        if (user == null)
        {
            var matchedUsers = await _context.Users
                .Include(u => u.Role)
                .Where(u => u.Email.ToLower() == input)
                .ToListAsync(cancellationToken);

            if (matchedUsers.Count > 1)
            {
                throw new UnauthorizedAccessException("Email này liên kết với nhiều tài khoản. Vui lòng đăng nhập bằng Tên đăng nhập (Username).");
            }

            user = matchedUsers.FirstOrDefault();
        }

        if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Tên đăng nhập hoặc mật khẩu không chính xác.");
        }

        if (!user.IsActive)
        {
            throw new UnauthorizedAccessException("Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên.");
        }

        if (!user.EmailConfirmed)
        {
            throw new UnauthorizedAccessException("Tài khoản chưa được xác thực email. Vui lòng nhập mã OTP để kích hoạt tài khoản.");
        }

        var roleName = user.Role?.Name;
        var (token, expiresAt) = _jwtTokenGenerator.GenerateToken(user, roleName);

        return new AuthResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                FullName = user.FullName,
                RoleId = user.RoleId,
                RoleName = roleName,
                IsActive = user.IsActive,
                CreatedAt = user.CreatedAt
            }
        };
    }
}
