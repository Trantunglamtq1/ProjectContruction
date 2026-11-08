import React, { useEffect, useRef } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Radio,
  Checkbox,
  DatePicker,
  Card,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  message,
} from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import type { FormIoComponent, FormIoSchema } from '../../types/inspection';

const { Text } = Typography;

interface DynamicFormIoRendererProps {
  schema: FormIoSchema | null;
  initialData?: Record<string, any>;
  readonly?: boolean;
  form?: FormInstance;
  onChange?: (values: Record<string, any>) => void;
}

// --- Collision Resolver ---
/**
 * Chống đè lấn (No-Overlap Collision Resolver):
 * Chỉ đẩy các thành phần xuống khi chúng thực sự chồng lên nhau theo cả X và Y.
 * Không tự ý thay đổi kích thước (h) để đảm bảo Xem trước khớp đúng với Canvas.
 */
export function preventComponentCollisions(components: FormIoComponent[]): FormIoComponent[] {
  if (!components || components.length === 0) return [];

  // Tạo bản sao để không làm biến đổi mảng gốc
  const items = components.map((c) => ({ ...c }));

  // Sắp xếp các ô theo trục Y tăng dần
  items.sort((a, b) => (a.y ?? 0) - (b.y ?? 0));

  const getHeight = (c: FormIoComponent) =>
    c.h ?? c.height ?? (c.type === 'textarea' ? 90 : c.type === 'button' ? 38 : c.type === 'heading' ? 36 : 58);

  for (let i = 0; i < items.length; i++) {
    const cur = items[i];
    const curX = cur.x ?? 20;
    const curW = cur.w ?? cur.width ?? 360;
    let requiredY = cur.y ?? 20;

    // So sánh với mọi phần tử phía trên
    for (let j = 0; j < i; j++) {
      const prev = items[j];
      const prevX = prev.x ?? 20;
      const prevW = prev.w ?? prev.width ?? 360;
      const prevY = prev.y ?? 20;
      const prevH = getHeight(prev);

      // Hai phần tử có giao nhau theo phương ngang (X overlap) không?
      const isHorizontalOverlap = Math.max(curX, prevX) < Math.min(curX + curW, prevX + prevW);

      if (isHorizontalOverlap) {
        // Chỉ đẩy xuống vừa đủ để không đè lên nhau (không cộng thêm khoảng hở)
        const minTop = prevY + prevH;
        if (minTop > requiredY) {
          requiredY = minTop;
        }
      }
    }

    cur.y = requiredY;
  }

  return items;
}

export const DynamicFormIoRenderer: React.FC<DynamicFormIoRendererProps> = ({
  schema,
  initialData = {},
  readonly = false,
  form: externalForm,
  onChange,
}) => {
  const [internalForm] = Form.useForm();
  const form = externalForm || internalForm;
  // Chỉ hiện thông báo 1 lần cho mỗi nút, tránh xếp chồng thông báo khi bấm nhiều lần
  const shownBtnClickRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      // Chuyển đổi các trường ngày tháng sang Dayjs nếu cần
      const formattedData: Record<string, any> = { ...initialData };
      if (schema?.components) {
        formatDatesForForm(schema.components, formattedData);
      }
      form.setFieldsValue(formattedData);
    } else {
      form.resetFields();
    }
  }, [initialData, schema, form]);

  const formatDatesForForm = (components: FormIoComponent[], data: Record<string, any>) => {
    for (const comp of components) {
      if ((comp.type === 'datetime' || comp.type === 'day') && data[comp.key]) {
        try {
          data[comp.key] = dayjs(data[comp.key]);
        } catch {
          // keep original
        }
      }
      if (comp.components) formatDatesForForm(comp.components, data);
      if (comp.columns) {
        comp.columns.forEach((col) => formatDatesForForm(col.components, data));
      }
    }
  };

  const handleValuesChange = (_: any, allValues: any) => {
    if (onChange) {
      // Serialize dayjs dates sang string ISO
      const serializedValues: Record<string, any> = {};
      for (const [k, v] of Object.entries(allValues)) {
        if (dayjs.isDayjs(v)) {
          serializedValues[k] = v.toISOString();
        } else {
          serializedValues[k] = v;
        }
      }
      onChange(serializedValues);
    }
  };

  // Render một component FormIO cụ thể
  const renderComponent = (comp: FormIoComponent, isAbsolute = false): React.ReactNode => {
    // 0. Header / Tiêu đề nhóm / Nhãn phân đoạn
    if (comp.type === 'heading' || comp.type === 'label') {
      return (
        <div style={{ padding: isAbsolute ? '2px 0' : '8px 0 4px 0', borderBottom: '2px solid #E2E8F0', marginBottom: isAbsolute ? 0 : 14, height: isAbsolute ? '100%' : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 4, height: 16, backgroundColor: '#1677FF', borderRadius: 2 }} />
            <Text strong style={{ fontSize: comp.fontSize || 14, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              {comp.label}
            </Text>
          </div>
          {comp.description && (
            <div style={{ color: '#64748B', fontSize: 12, marginTop: 2, paddingLeft: 12 }}>
              {comp.description}
            </div>
          )}
        </div>
      );
    }

    // 0b. Nút bấm hành động (Button) trên form — giao diện nghiêm túc chuẩn doanh nghiệp
    if (comp.type === 'button') {
      const btnFontSize = comp.fontSize || Math.max(12, Math.min(15, Math.round((comp.h || 38) * 0.35)));
      const bg = comp.buttonTheme === 'danger' ? '#DC2626' : comp.buttonTheme === 'default' ? '#FFFFFF' : '#1677FF';
      const fg = comp.buttonTheme === 'default' ? '#1E293B' : '#FFFFFF';
      const border = comp.buttonTheme === 'default' ? '1px solid #CBD5E1' : 'none';
      return (
        <div
          key={comp.key || comp.label}
          style={{
            width: '100%',
            height: isAbsolute ? '100%' : 38,
            marginBottom: isAbsolute ? 0 : 14,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: bg,
              color: fg,
              border,
              borderRadius: 6,
              fontWeight: 600,
              fontSize: btnFontSize,
              cursor: readonly ? 'default' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              opacity: readonly ? 0.65 : 1,
              padding: '0 16px',
              boxSizing: 'border-box',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              letterSpacing: '0.01em',
            }}
            onClick={() => {
              if (readonly) return;
              const btnKey = comp.key || comp.label || 'form_btn';
              if (shownBtnClickRef.current.has(btnKey)) {
                // Đã hiện thông báo cho nút này rồi -> không lặp lại
                return;
              }
              shownBtnClickRef.current.add(btnKey);
              message.success({
                content: `Đã kích hoạt hành động: "${comp.label}"`,
                key: `form_btn_action_${btnKey}`,
                duration: 2,
              });
            }}
          >
            {comp.label}
          </div>
        </div>
      );
    }

    // 1. Container: Panel / Fieldset
    if (comp.type === 'panel' || comp.type === 'fieldset') {
      return (
        <Card
          key={comp.key || comp.label}
          title={
            <Space>
              <span style={{ color: '#1677FF', fontWeight: 600 }}>●</span>
              <span>{comp.label}</span>
            </Space>
          }
          size="small"
          style={{
            marginBottom: isAbsolute ? 0 : 16,
            borderRadius: 8,
            border: '1px solid #E8EEF5',
            backgroundColor: '#FAFCFF',
            height: isAbsolute ? '100%' : 'auto',
          }}
          headStyle={{
            backgroundColor: '#F0F6FF',
            borderBottom: '1px solid #E1EDFA',
            fontSize: 14,
          }}
        >
          <Row gutter={[16, 12]}>
            {comp.components?.map((child) => {
              const childSpan = child.colSpan
                ? (child.colSpan <= 12 ? Math.min(24, Math.max(1, child.colSpan * 2)) : Math.min(24, Math.max(1, child.colSpan)))
                : 24;
              return (
                <Col span={childSpan} key={child.key}>
                  {renderComponent(child, false)}
                </Col>
              );
            })}
          </Row>
        </Card>
      );
    }

    // 2. Layout: Columns
    if (comp.type === 'columns' && comp.columns) {
      return (
        <Row gutter={[16, 0]} key={comp.key || Math.random().toString()}>
          {comp.columns.map((col, idx) => {
            const span = col.width ? Math.min(24, Math.max(1, Math.round((col.width / 12) * 24))) : 24 / comp.columns!.length;
            return (
              <Col span={span} key={idx}>
                {col.components?.map((child) => renderComponent(child))}
              </Col>
            );
          })}
        </Row>
      );
    }

    // Các trường nhập liệu thông thường
    const isRequired = comp.validate?.required || false;
    const rules = [];
    if (isRequired && !readonly) {
      rules.push({ required: true, message: `Vui lòng nhập ${comp.label || comp.key}` });
    }

    // Layout tuyệt đối (WinForms): nhãn được vẽ gọn thủ công (18px) và control
    // được giới hạn đúng chiều cao để không tràn khung, tránh đè lên thành phần bên dưới.
    const absH = isAbsolute ? (comp.h ?? comp.height ?? 58) : undefined;
    const absLabelH = absH !== undefined ? Math.min(18, Math.max(14, Math.round(absH * 0.3))) : 0;
    const controlH = absH !== undefined ? Math.max(24, absH - absLabelH - 2) : undefined;
    const controlStyle: React.CSSProperties | undefined = controlH
      ? { height: controlH }
      : undefined;

    let inputElement: React.ReactNode = null;

    switch (comp.type) {
      case 'textfield':
        inputElement = readonly ? (
          <div style={{ padding: '4px 0', fontWeight: 500 }}>
            {initialData[comp.key] || <Text type="secondary">—</Text>}
          </div>
        ) : (
          <Input
            placeholder={comp.placeholder || `Nhập ${comp.label}`}
            prefix={comp.prefix}
            suffix={comp.suffix}
            disabled={readonly}
            style={controlStyle}
          />
        );
        break;

      case 'textarea':
        inputElement = readonly ? (
          <div style={{ padding: '4px 0', whiteSpace: 'pre-wrap' }}>
            {initialData[comp.key] || <Text type="secondary">—</Text>}
          </div>
        ) : (
          <Input.TextArea
            rows={comp.rows || 3}
            placeholder={comp.placeholder || `Nhập ${comp.label}`}
            disabled={readonly}
            style={
              controlH
                ? { height: Math.max(36, controlH), minHeight: Math.max(36, controlH), resize: 'none' }
                : undefined
            }
          />
        );
        break;

      case 'number':
        inputElement = readonly ? (
          <div style={{ padding: '4px 0', fontWeight: 600, color: '#1677FF' }}>
            {initialData[comp.key] !== undefined && initialData[comp.key] !== null ? (
              <span>
                {initialData[comp.key]} {comp.suffix && <Tag color="blue">{comp.suffix}</Tag>}
              </span>
            ) : (
              <Text type="secondary">—</Text>
            )}
          </div>
        ) : (
          <InputNumber
            style={{ width: '100%', ...(controlH ? { height: controlH } : {}) }}
            placeholder={comp.placeholder || `Nhập số`}
            min={comp.validate?.min}
            max={comp.validate?.max}
            addonAfter={comp.suffix}
            disabled={readonly}
          />
        );
        break;

      case 'select': {
        const options = (comp.data?.values || comp.values || []).map((v) => ({
          label: v.label,
          value: v.value,
        }));
        inputElement = readonly ? (
          <div style={{ padding: '4px 0' }}>
            {initialData[comp.key] ? (
              <Tag color="cyan">{options.find((o) => o.value === initialData[comp.key])?.label || initialData[comp.key]}</Tag>
            ) : (
              <Text type="secondary">—</Text>
            )}
          </div>
        ) : (
          <Select
            placeholder={comp.placeholder || `Chọn ${comp.label}`}
            options={options}
            disabled={readonly}
            allowClear
            style={{ width: '100%', ...(controlH ? { height: controlH } : {}) }}
          />
        );
        break;
      }

      case 'radio': {
        const radioValues = comp.values || comp.data?.values || [];
        inputElement = readonly ? (
          <div style={{ padding: '4px 0' }}>
            {initialData[comp.key] === 'Pass' || initialData[comp.key] === 'Dat' ? (
              <Tag color="success">ĐẠT (PASS)</Tag>
            ) : initialData[comp.key] === 'Fail' || initialData[comp.key] === 'KhongDat' ? (
              <Tag color="error">KHÔNG ĐẠT (FAIL)</Tag>
            ) : (
              <Tag color="default">{initialData[comp.key] || '—'}</Tag>
            )}
          </div>
        ) : (
          <Radio.Group style={{ width: '100%' }} disabled={readonly}>
            <Space direction="horizontal" size={[16, 6]} wrap style={{ width: '100%' }}>
              {radioValues.map((v) => (
                <Radio key={v.value} value={v.value} style={{ fontSize: 13, lineHeight: '20px' }}>
                  {v.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        );
        break;
      }

      case 'checkbox':
        inputElement = readonly ? (
          <div>{initialData[comp.key] ? <Tag color="success">Có</Tag> : <Tag color="default">Không</Tag>}</div>
        ) : (
          <Checkbox disabled={readonly}>{comp.label}</Checkbox>
        );
        break;

      case 'datetime':
      case 'day':
        inputElement = readonly ? (
          <div style={{ padding: '4px 0' }}>
            {initialData[comp.key] ? dayjs(initialData[comp.key]).format('DD/MM/YYYY HH:mm') : <Text type="secondary">—</Text>}
          </div>
        ) : (
          <DatePicker
            showTime={comp.type === 'datetime'}
            format={comp.type === 'datetime' ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY'}
            style={{ width: '100%', ...(controlH ? { height: controlH } : {}) }}
            disabled={readonly}
          />
        );
        break;

      default:
        inputElement = readonly ? (
          <div>{String(initialData[comp.key] || '—')}</div>
        ) : (
          <Input placeholder={comp.placeholder || comp.label} disabled={readonly} style={controlStyle} />
        );
        break;
    }

    // === LAYOUT TUYỆT ĐỐI (WinForms): nhãn gọn + control vừa khít khung ===
    if (isAbsolute) {
      if (comp.type === 'checkbox') {
        return (
          <Form.Item
            key={comp.key}
            name={comp.key}
            valuePropName="checked"
            rules={rules}
            style={{ marginBottom: 0, height: '100%', display: 'flex', alignItems: 'center' }}
          >
            {inputElement}
          </Form.Item>
        );
      }

      return (
        <div
          key={comp.key}
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            style={{
              height: absLabelH,
              lineHeight: `${absLabelH}px`,
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 600,
              color: '#475569',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {comp.label}
            {isRequired && !/\*\s*$/.test(comp.label || '') && (
              <span style={{ color: '#EF4444' }}> *</span>
            )}
          </div>
          <Form.Item
            name={comp.key}
            rules={rules}
            style={{ marginBottom: 0, flex: 1, minHeight: 0 }}
          >
            {inputElement}
          </Form.Item>
        </div>
      );
    }

    // Nếu là checkbox, hiển thị nhãn khác biệt một chút
    if (comp.type === 'checkbox') {
      return (
        <Form.Item
          key={comp.key}
          name={comp.key}
          valuePropName="checked"
          rules={rules}
          style={{ marginBottom: isAbsolute ? 0 : 14, height: isAbsolute ? '100%' : 'auto' }}
        >
          {inputElement}
        </Form.Item>
      );
    }

    return (
      <Form.Item
        key={comp.key}
        name={comp.key}
        label={
          <span
            style={{
              display: 'block',
              width: '100%',
              fontWeight: 500,
              color: '#374151',
              fontSize: 13,
              lineHeight: '18px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {comp.label}
            {!isAbsolute && comp.description && (
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 6, fontWeight: 'normal' }}>
                ({comp.description})
              </Text>
            )}
          </span>
        }
        rules={rules}
        style={{ marginBottom: isAbsolute ? 0 : 14, height: isAbsolute ? '100%' : 'auto' }}
      >
        {inputElement}
      </Form.Item>
    );
  };

  if (!schema || !schema.components || schema.components.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <Text type="secondary">Chưa có cấu hình FormIO Schema cho biểu mẫu này.</Text>
      </div>
    );
  }

  // Nếu biểu mẫu được định dạng tọa độ 2D tự do kiểu WinForms (x, y)
  const hasCoordinates = schema.components.some((c) => c.x !== undefined && c.y !== undefined);

  if (hasCoordinates) {
    const resolvedComponents = preventComponentCollisions(schema.components);
    const maxX = Math.max(...resolvedComponents.map((c) => (c.x ?? 0) + (c.w ?? c.width ?? 300)), 820);
    const maxY = Math.max(...resolvedComponents.map((c) => (c.y ?? 0) + (c.h ?? c.height ?? 50)), 650);

    return (
      <Form
        form={form}
        layout="vertical"
        requiredMark={!readonly}
        onValuesChange={handleValuesChange}
        style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}
      >
        <div
          style={{
            position: 'relative',
            width: Math.max(maxX + 30, 820),
            minHeight: maxY + 40,
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            border: '1px solid #E2E8F0',
            padding: 10,
          }}
        >
          {resolvedComponents.map((comp) => {
            const width = comp.w ?? comp.width ?? 360;
            const height = comp.h ?? comp.height ?? (comp.type === 'textarea' ? 80 : comp.type === 'button' ? 38 : 58);
            return (
              <div
                key={comp.key || Math.random().toString()}
                style={{
                  position: 'absolute',
                  left: comp.x ?? 20,
                  top: comp.y ?? 20,
                  width: width,
                  minHeight: height,
                  boxSizing: 'border-box',
                }}
              >
                {renderComponent(comp, true)}
              </div>
            );
          })}
        </div>
      </Form>
    );
  }

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={!readonly}
      onValuesChange={handleValuesChange}
      style={{ width: '100%' }}
    >
      <Row gutter={[16, 8]}>
        {schema.components.map((comp) => {
          // Chuẩn hóa colSpan từ hệ 12 sang hệ 24 của Ant Design
          let span = 24;
          if (comp.colSpan) {
            span = comp.colSpan <= 12 ? Math.min(24, Math.max(1, comp.colSpan * 2)) : Math.min(24, Math.max(1, comp.colSpan));
          } else if (comp.columns && comp.columns.length > 0) {
            span = 24;
          }

          return (
            <Col span={span} key={comp.key || Math.random().toString()}>
              {renderComponent(comp, false)}
            </Col>
          );
        })}
      </Row>
    </Form>
  );
};
