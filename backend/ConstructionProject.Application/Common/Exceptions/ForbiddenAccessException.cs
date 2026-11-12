namespace ConstructionProject.Application.Common.Exceptions;

public sealed class ForbiddenAccessException(string message) : Exception(message);
