using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Auth.Commands;

public record RegisterCommand(
    string Username,
    string Email,
    string Password,
    string FullName
) : IRequest<UserDto>;

public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Tên đăng nhập không được để trống.")
            .MinimumLength(3).WithMessage("Tên đăng nhập tối thiểu 3 ký tự.")
            .MaximumLength(50).WithMessage("Tên đăng nhập tối đa 50 ký tự.")
            .Matches(@"^[a-zA-Z0-9_]+$").WithMessage("Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Email không hợp lệ.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Mật khẩu không được để trống.")
            .MinimumLength(6).WithMessage("Mật khẩu tối thiểu 6 ký tự.");

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Họ và tên không được để trống.")
            .MaximumLength(100).WithMessage("Họ và tên tối đa 100 ký tự.");
    }
}

public class RegisterCommandHandler : IRequestHandler<RegisterCommand, UserDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _passwordHasher;

    public RegisterCommandHandler(IApplicationDbContext context, IPasswordHasher passwordHasher)
    {
        _context = context;
        _passwordHasher = passwordHasher;
    }

    public async Task<UserDto> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var normalizedUsername = request.Username.Trim().ToLowerInvariant();
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var usernameExists = await _context.Users
            .AnyAsync(u => u.Username.ToLower() == normalizedUsername, cancellationToken);
        if (usernameExists)
        {
            throw new InvalidOperationException($"Tên đăng nhập '{request.Username}' đã được sử dụng.");
        }

        var emailExists = await _context.Users
            .AnyAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);
        if (emailExists)
        {
            throw new InvalidOperationException($"Email '{request.Email}' đã được sử dụng.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username.Trim(),
            Email = request.Email.Trim(),
            FullName = request.FullName.Trim(),
            PasswordHash = _passwordHasher.HashPassword(request.Password),
            // Theo đặc tả: Tài khoản mới tạo ra có RoleId = null (chưa có quyền nghiệp vụ nào)
            RoleId = null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        return new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            RoleId = null,
            RoleName = null,
            IsActive = true,
            CreatedAt = user.CreatedAt
        };
    }
}
