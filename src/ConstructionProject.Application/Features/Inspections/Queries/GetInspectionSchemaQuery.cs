using MediatR;

namespace ConstructionProject.Application.Features.Inspections.Queries;

public record GetInspectionSchemaQuery(string SchemaId = "default-inspection-schema") : IRequest<string>;

public class GetInspectionSchemaQueryHandler : IRequestHandler<GetInspectionSchemaQuery, string>
{
    public Task<string> Handle(GetInspectionSchemaQuery request, CancellationToken cancellationToken)
    {
        var schemaName = string.IsNullOrWhiteSpace(request.SchemaId) ? "default-inspection-schema" : request.SchemaId.Trim();
        if (!schemaName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
        {
            schemaName += ".json";
        }

        // Tìm kiếm schema file từ thư mục domain hoặc thư mục thực thi
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var searchPaths = new[]
        {
            Path.Combine(baseDir, "Schemas", schemaName),
            Path.Combine(baseDir, "..", "..", "..", "..", "ConstructionProject.Domain", "Schemas", schemaName),
            Path.Combine(Directory.GetCurrentDirectory(), "Schemas", schemaName),
            Path.Combine(Directory.GetCurrentDirectory(), "..", "ConstructionProject.Domain", "Schemas", schemaName),
            Path.Combine(Directory.GetCurrentDirectory(), "src", "ConstructionProject.Domain", "Schemas", schemaName)
        };

        foreach (var path in searchPaths)
        {
            var fullPath = Path.GetFullPath(path);
            if (File.Exists(fullPath))
            {
                var content = File.ReadAllText(fullPath);
                return Task.FromResult(content);
            }
        }

        // Schema mặc định fallback nếu file không tìm thấy
        var fallbackSchema = """
        {
          "display": "form",
          "components": [
            {
              "label": "Tên hạng mục kiểm tra",
              "key": "inspectionTitle",
              "type": "textfield",
              "input": true,
              "validate": { "required": true }
            },
            {
              "label": "Ngày kiểm tra",
              "key": "inspectionDate",
              "type": "datetime",
              "format": "yyyy-MM-dd hh:mm a",
              "enableDate": true,
              "enableTime": true,
              "input": true,
              "validate": { "required": true }
            },
            {
              "label": "Kết quả đánh giá",
              "key": "result",
              "type": "select",
              "data": {
                "values": [
                  { "label": "Đạt yêu cầu (Pass)", "value": "pass" },
                  { "label": "Không đạt yêu cầu (Fail)", "value": "fail" },
                  { "label": "Chờ khắc phục (Pending Fix)", "value": "pending_fix" }
                ]
              },
              "input": true,
              "validate": { "required": true }
            },
            {
              "label": "Chi tiết kiểm tra & Sai số kỹ thuật",
              "key": "technicalDetails",
              "type": "textarea",
              "rows": 3,
              "input": true
            },
            {
              "label": "Ghi chú & Khuyến nghị",
              "key": "notes",
              "type": "textarea",
              "rows": 2,
              "input": true
            }
          ]
        }
        """;

        return Task.FromResult(fallbackSchema);
    }
}
