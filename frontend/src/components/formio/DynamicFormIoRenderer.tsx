import React, { useEffect } from 'react';
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

export const DynamicFormIoRenderer: React.FC<DynamicFormIoRendererProps> = ({
  schema,
  initialData = {},
  readonly = false,
  form: externalForm,
  onChange,
}) => {
  const [internalForm] = Form.useForm();
  const form = externalForm || internalForm;

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
  const renderComponent = (comp: FormIoComponent): React.ReactNode => {
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
            marginBottom: 16,
            borderRadius: 8,
            border: '1px solid #E8EEF5',
            backgroundColor: '#FAFCFF',
          }}
          headStyle={{
            backgroundColor: '#F0F6FF',
            borderBottom: '1px solid #E1EDFA',
            fontSize: 14,
          }}
        >
          {comp.components?.map((child) => renderComponent(child))}
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
            style={{ width: '100%' }}
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
          <Radio.Group disabled={readonly}>
            <Space>
              {radioValues.map((v) => (
                <Radio key={v.value} value={v.value}>
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
            style={{ width: '100%' }}
            disabled={readonly}
          />
        );
        break;

      default:
        inputElement = readonly ? (
          <div>{String(initialData[comp.key] || '—')}</div>
        ) : (
          <Input placeholder={comp.placeholder || comp.label} disabled={readonly} />
        );
        break;
    }

    // Nếu là checkbox, hiển thị nhãn khác biệt một chút
    if (comp.type === 'checkbox') {
      return (
        <Form.Item
          key={comp.key}
          name={comp.key}
          valuePropName="checked"
          rules={rules}
          style={{ marginBottom: 14 }}
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
          <span style={{ fontWeight: 500, color: '#374151' }}>
            {comp.label}
            {comp.description && (
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 6, fontWeight: 'normal' }}>
                ({comp.description})
              </Text>
            )}
          </span>
        }
        rules={rules}
        style={{ marginBottom: 14 }}
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

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={!readonly}
      onValuesChange={handleValuesChange}
      style={{ width: '100%' }}
    >
      {schema.components.map((comp) => renderComponent(comp))}
    </Form>
  );
};
