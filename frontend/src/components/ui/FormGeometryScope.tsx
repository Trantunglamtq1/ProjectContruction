import { ConfigProvider } from 'antd';
import type { ReactNode } from 'react';
import { geometryTheme } from '../../config/theme';
export function FormGeometryScope({ children }: { children: ReactNode }) {
  return <ConfigProvider theme={geometryTheme} componentSize="middle"><div className="form-geometry-scope">{children}</div></ConfigProvider>;
}
