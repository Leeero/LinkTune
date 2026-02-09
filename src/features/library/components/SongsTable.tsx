import { Table } from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';
import type { RefObject } from 'react';

import type { UnifiedSong } from '../types';

type Props<T = UnifiedSong> = {
  tableWrapRef: RefObject<HTMLDivElement | null>;
  songs: T[];
  columns: ColumnsType<T>;
  loading: boolean;
  tableBodyY: number;
  rowKey?: string | ((row: T) => string);
  components?: TableProps<T>['components'];
  onRowDoubleClick: (row: T) => void;
};

export function SongsTable<T extends { id: string }>(props: Props<T>) {
  const { tableWrapRef, songs, columns, loading, tableBodyY, rowKey, components, onRowDoubleClick } = props;

  return (
    <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0 }}>
      <Table<T>
        virtual={!components} // 使用自定义 components 时禁用虚拟滚动（拖拽排序需要）
        rowKey={rowKey ?? ((r) => r.id)}
        columns={columns}
        dataSource={songs}
        loading={loading}
        size="middle"
        pagination={false}
        sticky
        scroll={{ y: tableBodyY }}
        components={components}
        onRow={(record) => {
          return {
            onDoubleClick: async () => {
              onRowDoubleClick(record);
            },
            'data-row-key': typeof rowKey === 'function' ? rowKey(record) : record.id,
          } as React.HTMLAttributes<HTMLTableRowElement>;
        }}
      />
    </div>
  );
}
