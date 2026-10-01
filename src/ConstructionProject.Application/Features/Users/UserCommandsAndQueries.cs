using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Users;

// Query: Danh sách người dùng
public record GetUsersQuery : IRequest<List<UserDto>>;

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, List<UserDto>>
{
    private readonly IApplicationDbContext _context;

    public GetUsersQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        return await _context.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .OrderByDescending(u => u.CreatedAt)
            .Select(u => new UserDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                FullName = u.FullName,
                RoleId = u.RoleId,
                RoleName = u.Role != null ? u.Role.Name : null,
                IsActive = u.IsActive,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }
}

// Query: Danh sách các Role có trong hệ thống
public record GetRolesQuery : IRequest<List<RoleDto>>;

public class GetRolesQueryHandler : IRequestHandler<GetRolesQuery, List<RoleDto>>
{
    private readonly IApplicationDbContext _context;

    public GetRolesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<RoleDto>> Handle(GetRolesQuery request, CancellationToken cancellationToken)
    {
        return await _context.Roles
            .AsNoTracking()
            .Select(r => new RoleDto
            {
                Id = r.Id,
                Name = r.Name,
                Description = r.Description,
                UserCount = r.Users.Count
            })
            .ToListAsync(cancellationToken);
    }
}

// Command: Admin gán hoặc đổi Role cho User
public record AssignRoleCommand(
    Guid UserId,
    Guid? RoleId
) : IRequest<UserDto>;

public class AssignRoleCommandValidator : AbstractValidator<AssignRoleCommand>
{
    public AssignRoleCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("UserId không được để trống.");
    }
}

public class AssignRoleCommandHandler : IRequestHandler<AssignRoleCommand, UserDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public AssignRoleCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<UserDto> Handle(AssignRoleCommand request, CancellationToken cancellationToken)
    {
        if (_currentUserService.UserId.HasValue && _currentUserService.UserId.Value == request.UserId)
        {
            throw new InvalidOperationException("Quản trị viên không thể tự thay đổi vai trò của chính mình để tránh khóa tài khoản.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy người dùng với Id = {request.UserId}.");
        }

        string? newRoleName = null;
        if (request.RoleId.HasValue && request.RoleId.Value != Guid.Empty)
        {
            var role = await _context.Roles
                .FirstOrDefaultAsync(r => r.Id == request.RoleId.Value, cancellationToken);
            if (role == null)
            {
                throw new KeyNotFoundException($"Không tìm thấy Role với Id = {request.RoleId.Value}.");
            }
            user.RoleId = role.Id;
            newRoleName = role.Name;
        }
        else
        {
            user.RoleId = null;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            RoleId = user.RoleId,
            RoleName = newRoleName,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }
}

// Command: Admin vô hiệu hóa hoặc kích hoạt tài khoản người dùng
public record UpdateUserStatusCommand(
    Guid UserId,
    bool IsActive
) : IRequest<UserDto>;

public class UpdateUserStatusCommandValidator : AbstractValidator<UpdateUserStatusCommand>
{
    public UpdateUserStatusCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("UserId không được để trống.");
    }
}

public class UpdateUserStatusCommandHandler : IRequestHandler<UpdateUserStatusCommand, UserDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public UpdateUserStatusCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<UserDto> Handle(UpdateUserStatusCommand request, CancellationToken cancellationToken)
    {
        if (_currentUserService.UserId.HasValue && _currentUserService.UserId.Value == request.UserId && !request.IsActive)
        {
            throw new InvalidOperationException("Quản trị viên không thể tự vô hiệu hóa tài khoản của chính mình.");
        }

        var user = await _context.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

        if (user == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy người dùng với Id = {request.UserId}.");
        }

        user.IsActive = request.IsActive;
        await _context.SaveChangesAsync(cancellationToken);

        return new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            RoleId = user.RoleId,
            RoleName = user.Role?.Name,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }
}

// Query: Lấy thông tin tài khoản hiện tại
public record GetCurrentUserQuery : IRequest<UserDto?>;

public class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, UserDto?>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public GetCurrentUserQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<UserDto?> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserService.UserId.HasValue)
        {
            return null;
        }

        var user = await _context.Users
            .AsNoTracking()
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == _currentUserService.UserId.Value, cancellationToken);

        if (user == null) return null;

        return new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            RoleId = user.RoleId,
            RoleName = user.Role?.Name,
            IsActive = user.IsActive,
            CreatedAt = user.CreatedAt
        };
    }
}
