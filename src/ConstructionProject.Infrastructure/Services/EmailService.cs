using ConstructionProject.Application.Common.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace ConstructionProject.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly EmailSettings _settings;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _logger = logger;
        _settings = new EmailSettings();
        configuration.GetSection("EmailSettings").Bind(_settings);
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_settings.SenderEmail) || string.IsNullOrWhiteSpace(_settings.Password))
        {
            _logger.LogWarning("EmailSettings chưa được cấu hình đầy đủ (SenderEmail/Password trống). Bỏ qua gửi email tới: {ToEmail}", toEmail);
            return;
        }

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = htmlBody
            };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            
            // Chấp nhận mọi chứng chỉ SSL trong môi trường dev nếu cần thiết
            client.ServerCertificateValidationCallback = (s, c, h, e) => true;

            var secureSocketOption = _settings.Port == 465 
                ? SecureSocketOptions.SslOnConnect 
                : SecureSocketOptions.StartTls;

            await client.ConnectAsync(_settings.SmtpServer, _settings.Port, secureSocketOption, cancellationToken);
            await client.AuthenticateAsync(_settings.SenderEmail, _settings.Password, cancellationToken);
            await client.SendAsync(message, cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);

            _logger.LogInformation("Đã gửi email thành công tới: {ToEmail} | Tiêu đề: {Subject}", toEmail, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi gửi email tới {ToEmail}: {Message}", toEmail, ex.Message);
            throw new InvalidOperationException($"Không thể gửi email tới {toEmail}: {ex.Message}", ex);
        }
    }
}
