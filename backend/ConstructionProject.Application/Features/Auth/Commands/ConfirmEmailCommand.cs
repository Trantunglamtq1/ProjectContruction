using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Auth.Commands;

public record ConfirmEmailCommand(
    string Username,
    string OtpCode
) : IRequest<AuthResponseDto>;

public class ConfirmEmailCommandValidator : AbstractValidator<ConfirmEmailCommand>
{
    public ConfirmEmailCommandValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Vui lòng nhập tên tài khoản.");

        RuleFor(x => x.OtpCode)
            .NotEmpty().WithMessage("Vui lòng nhập mã xác thực OTP.")
            .Length(6).WithMessage("Mã OTP phải có 6 chữ số.");
    }
}

public class ConfirmEmailCommandHandler : IRequestHandler<ConfirmEmailCommand, AuthResponseDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;

    public ConfirmEmailCommandHandler(
        IApplicationDbContext context, 
        IJwtTokenGenerator jwtTokenGenerator)
    {
        _context = context;
        _jwtTokenGenerator = jwtTokenGenerator;
    }

    public async Task<AuthResponseDto> Handle(ConfirmEmailCommand request, CancellationToken cancellationToken)
    {
        var normalizedUsername = request.Username.Trim().ToLowerInvariant();

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Username.ToLower() == normalizedUsername, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException("Không tìm thấy tài khoản người dùng.");
        }

        if (user.EmailConfirmed)
        {
            var role = user.Role?.Name;
            var (t, exp) = _jwtTokenGenerator.GenerateToken(user, role);
            return new AuthResponseDto
            {
                Token = t,
                ExpiresAt = exp,
                User = new UserDto
                {
                    Id = user.Id,
                    Username = user.Username,
                    Email = user.Email,
                    FullName = user.FullName,
                    RoleId = user.RoleId,
                    RoleName = role,
                    IsActive = user.IsActive,
                    CreatedAt = user.CreatedAt
                }
            };
        }

        if (user.EmailConfirmationToken != request.OtpCode.Trim())
        {
            throw new InvalidOperationException("Mã OTP không chính xác. Vui lòng kiểm tra lại.");
        }

        if (user.EmailConfirmationTokenExpiresAt == null || user.EmailConfirmationTokenExpiresAt < DateTime.UtcNow)
        {
            throw new InvalidOperationException("Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.");
        }

        user.EmailConfirmed = true;
        user.EmailConfirmationToken = null;
        user.EmailConfirmationTokenExpiresAt = null;

        await _context.SaveChangesAsync(cancellationToken);

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
