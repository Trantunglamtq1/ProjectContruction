using System.Text.Json;
using ConstructionProject.Application.DTOs;
using MediatR;

namespace ConstructionProject.Application.Features.Inspections.Queries;

public record GetInspectionSchemasQuery : IRequest<List<FormSchemaItemDto>>;

public class GetInspectionSchemasQueryHandler : IRequestHandler<GetInspectionSchemasQuery, List<FormSchemaItemDto>>
{
    public Task<List<FormSchemaItemDto>> Handle(GetInspectionSchemasQuery request, CancellationToken cancellationToken)
    {
        var list = new List<FormSchemaItemDto>
        {
            new()
            {
                Id = "default-inspection-schema",
                Name = "Biểu mẫu Kiểm tra Hiện trường Tiêu chuẩn",
                Description = "Biểu mẫu chuẩn bao gồm: Tiêu đề, Ngày giờ, Kết quả (Pass/Fail), Sai số kỹ thuật và Ghi chú.",
                Category = "Tổng hợp",
                ComponentsCount = 5
            },
            new()
            {
                Id = "rebar-inspection-schema",
                Name = "Biểu mẫu Nghiệm thu Cốt thép Cấu kiện",
                Description = "Đặc thù cốt thép: Chủng loại thép, Đường kính, Khoảng cách đai, Chiều dày lớp bê tông bảo vệ, Mối nối buộc/hàn.",
                Category = "Cốt thép",
                ComponentsCount = 6
            },
            new()
            {
                Id = "concrete-inspection-schema",
                Name = "Biểu mẫu Nghiệm thu Bê tông Tươi & Đổ bê tông",
                Description = "Kiểm tra độ sụt, Nhiệt độ hỗn hợp bê tông, Số lượng xe bồn, Vị trí lấy mẫu nén R28, Thời gian bắt đầu/kết thúc.",
                Category = "Bê tông",
                ComponentsCount = 7
            }
        };

        return Task.FromResult(list);
    }
}
