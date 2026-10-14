using ConstructionProject.Application.Common.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Application.Features.Auth.Commands;

public record ResendOtpCommand(
    string Username
) : IRequest<bool>;

public class ResendOtpCommandValidator : AbstractValidator<ResendOtpCommand>
{
    public ResendOtpCommandValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty().WithMessage("Vui lòng nhập tên tài khoản.");
    }
}

public class ResendOtpCommandHandler : IRequestHandler<ResendOtpCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly IEmailService _emailService;
    private readonly ILogger<ResendOtpCommandHandler> _logger;

    public ResendOtpCommandHandler(
        IApplicationDbContext context, 
        IEmailService emailService,
        ILogger<ResendOtpCommandHandler> logger)
    {
        _context = context;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<bool> Handle(ResendOtpCommand request, CancellationToken cancellationToken)
    {
        var normalizedUsername = request.Username.Trim().ToLowerInvariant();

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == normalizedUsername, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException("Không tìm thấy tài khoản người dùng.");
        }

        if (user.EmailConfirmed)
        {
            return true;
        }

        var newCode = Random.Shared.Next(100000, 999999).ToString();
        user.EmailConfirmationToken = newCode;
        user.EmailConfirmationTokenExpiresAt = DateTime.UtcNow.AddMinutes(15);

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Mã xác thực OTP mới cho '{Username}' ({Email}): {Code}", user.Username, user.Email, newCode);

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
            Bạn vừa yêu cầu gửi lại mã xác thực cho tài khoản <strong>{user.Username}</strong>. Dưới đây là mã OTP mới của bạn:
        </p>
        <div style='text-align: center; margin: 30px 0;'>
            <span style='font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #1677FF; background: #EFF6FF; padding: 12px 28px; border-radius: 8px; border: 1px dashed #BFDBFE; display: inline-block;'>{newCode}</span>
        </div>
        <p style='font-size: 13px; color: #6B7280; margin-bottom: 0;'>
            ⏱️ Mã xác thực này có hiệu lực trong vòng <strong>15 phút</strong>.
        </p>
    </div>
</div>";

            await _emailService.SendEmailAsync(
                user.Email,
                "Mã xác thực mới - ConstructInspect",
                emailBody,
                cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Không thể gửi email OTP mới tới {Email}: {Message}", user.Email, ex.Message);
        }

        return true;
    }
}
