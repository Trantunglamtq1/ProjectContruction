using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

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
    private readonly IEmailService _emailService;
    private readonly ILogger<RegisterCommandHandler> _logger;

    public RegisterCommandHandler(
        IApplicationDbContext context, 
        IPasswordHasher passwordHasher,
        IEmailService emailService,
        ILogger<RegisterCommandHandler> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<UserDto> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var normalizedUsername = request.Username.Trim().ToLowerInvariant();

        var usernameExists = await _context.Users
            .AnyAsync(u => u.Username.ToLower() == normalizedUsername, cancellationToken);
        if (usernameExists)
        {
            throw new InvalidOperationException($"Tên đăng nhập '{request.Username}' đã được sử dụng.");
        }

        // Sinh mã OTP 6 số xác thực email
        var verificationCode = Random.Shared.Next(100000, 999999).ToString();

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = request.Username.Trim(),
            Email = request.Email.Trim(),
            FullName = request.FullName.Trim(),
            PasswordHash = _passwordHasher.HashPassword(request.Password),
            RoleId = null,
            IsActive = true,
            EmailConfirmed = false,
            EmailConfirmationToken = verificationCode,
            EmailConfirmationTokenExpiresAt = DateTime.UtcNow.AddMinutes(15),
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Mã xác thực email cho tài khoản '{Username}' ({Email}) là: {Code}", user.Username, user.Email, verificationCode);

        // Gửi email xác thực thật tới địa chỉ email người dùng
        try
        {
            var emailBody = $@"
<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 8px;'>
    <div style='text-align: center; margin-bottom: 24px;'>
        <h2 style='color: #1677FF; margin: 0; font-size: 24px;'>ConstructInspect</h2>
        <p style='color: #6B7280; margin-top: 6px; font-size: 14px;'>Hệ thống Quản lý Nghiệm thu & Checklist Công trình</p>
    </div>
    <div style='background-color: #F9FAFB; padding: 24px; border-radius: 8px; margin-bottom: 20px;'>
        <p style='font-size: 16px; color: #1F2937; margin-top: 0;'>Xin chào <strong>{user.FullName}</strong>,</p>
        <p style='color: #4B5563; font-size: 14px; line-height: 1.6;'>
            Cảm ơn bạn đã đăng ký tài khoản (<strong>{user.Username}</strong>) tại ConstructInspect. Để hoàn tất kích hoạt tài khoản, vui lòng nhập mã xác thực OTP 6 số dưới đây:
        </p>
        <div style='text-align: center; margin: 30px 0;'>
            <span style='font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #1677FF; background: #EFF6FF; padding: 12px 28px; border-radius: 8px; border: 1px dashed #BFDBFE; display: inline-block;'>{verificationCode}</span>
        </div>
        <p style='font-size: 13px; color: #6B7280; margin-bottom: 0;'>
            ⏱️ Mã xác thực này có hiệu lực trong vòng <strong>15 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.
        </p>
    </div>
    <p style='font-size: 12px; color: #9CA3AF; text-align: center; margin: 0;'>
        Nếu bạn không thực hiện đăng ký tài khoản này, vui lòng bỏ qua email.
    </p>
</div>";

            await _emailService.SendEmailAsync(
                user.Email, 
                "Xác nhận đăng ký tài khoản - ConstructInspect", 
                emailBody, 
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Không thể gửi email xác thực tới {Email}: {Message}. Người dùng vẫn có thể dùng mã từ console để kích hoạt.", user.Email, ex.Message);
        }

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
