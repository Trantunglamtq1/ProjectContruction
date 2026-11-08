using ConstructionProject.Application.Features.Auth.Commands;
using ConstructionProject.Infrastructure.Services;
using FluentAssertions;

namespace ConstructionProject.UnitTests.Auth;

public class PasswordAndValidatorTests
{
    private readonly PasswordHasher _hasher = new();

    [Fact]
    public void HashPassword_ProducesVerifiableHash()
    {
        var hash = _hasher.HashPassword("Admin@123");

        hash.Should().NotBe("Admin@123");
        hash.Should().StartWith("$2");
        _hasher.VerifyPassword("Admin@123", hash).Should().BeTrue();
    }

    [Fact]
    public void VerifyPassword_WithWrongPassword_ReturnsFalse()
    {
        var hash = _hasher.HashPassword("Admin@123");

        _hasher.VerifyPassword("admin@123", hash).Should().BeFalse();
    }

    [Fact]
    public void VerifyPassword_WithMalformedHash_ReturnsFalseInsteadOfThrowing()
    {
        _hasher.VerifyPassword("anything", "not-a-bcrypt-hash").Should().BeFalse();
    }

    [Theory]
    [InlineData("ab", "a@b.com", "123456", "Nguyễn Văn A")] // username quá ngắn
    [InlineData("valid_user", "not-an-email", "123456", "Nguyễn Văn A")]
    [InlineData("valid_user", "a@b.com", "123", "Nguyễn Văn A")] // mật khẩu quá ngắn
    [InlineData("valid user", "a@b.com", "123456", "Nguyễn Văn A")] // khoảng trắng trong username
    [InlineData("valid_user", "a@b.com", "123456", "")] // thiếu họ tên
    public void RegisterValidator_RejectsInvalidPayload(string username, string email, string password, string fullName)
    {
        var validator = new RegisterCommandValidator();

        var result = validator.Validate(new RegisterCommand(username, email, password, fullName));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void RegisterValidator_AcceptsValidPayload()
    {
        var validator = new RegisterCommandValidator();

        var result = validator.Validate(
            new RegisterCommand("ky_su_01", "ky.su@example.com", "Secret123", "Nguyễn Văn A"));

        result.IsValid.Should().BeTrue();
    }
}
