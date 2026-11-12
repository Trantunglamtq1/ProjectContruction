import { Alert, Button, Empty } from 'antd';
export function QueryState({ error, retry, filtered = false, entity = 'dữ liệu' }: { error?: unknown; retry?: () => unknown; filtered?: boolean; entity?: string }) {
  if (error) return <Alert type="error" showIcon title={`Không tải được ${entity}`} description="Vui lòng thử lại. Bộ lọc và nội dung đang xem được giữ nguyên." action={retry && <Button onClick={() => { retry(); }}>Thử lại</Button>} />;
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filtered ? 'Không có kết quả phù hợp với bộ lọc.' : `Chưa có ${entity}.`} />;
}
