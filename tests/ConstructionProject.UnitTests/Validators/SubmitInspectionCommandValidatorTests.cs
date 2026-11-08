using ConstructionProject.Application.Features.Inspections.Commands;
using FluentAssertions;

namespace ConstructionProject.UnitTests.Validators;

public class SubmitInspectionCommandValidatorTests
{
    private readonly SubmitInspectionCommandValidator _validator = new();

    [Fact]
    public void Validate_WithEmptyId_IsInvalid()
    {
        var result = _validator.Validate(new SubmitInspectionCommand(Guid.Empty, "{\"a\":1}"));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(SubmitInspectionCommand.Id));
    }

    [Theory]
    [InlineData("{ invalid json")]
    [InlineData("[1,2,3]")] // phải là JSON object
    [InlineData("null")]
    public void Validate_WithMalformedOrNonObjectJson_IsInvalid(string json)
    {
        var result = _validator.Validate(new SubmitInspectionCommand(Guid.NewGuid(), json));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(SubmitInspectionCommand.FormDataJson));
    }

    [Fact]
    public void Validate_WithNullFormData_IsValid()
    {
        // FormDataJson có thể null khi submit dùng dữ liệu đã lưu trước đó
        var result = _validator.Validate(new SubmitInspectionCommand(Guid.NewGuid(), null));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_WithValidObjectJson_IsValid()
    {
        var result = _validator.Validate(new SubmitInspectionCommand(Guid.NewGuid(), "{\"ketQua\":\"Dat\"}"));

        result.IsValid.Should().BeTrue();
    }
}
