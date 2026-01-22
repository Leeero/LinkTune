import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { RefObject } from 'react';

import type { UnifiedSong } from '../types';

type Props<T = UnifiedSong> = {
  tableWrapRef: RefObject<HTMLDivElement | null>;
  songs: T[];
  columns: ColumnsType<T>;
  loading: boolean;
  tableBodyY: number;
  rowKey?: string | ((row: T) => string);
  onRowDoubleClick: (row: T) => void;
};

export function SongsTable<T extends { id: string }>(props: Props<T>) {
  const { tableWrapRef, songs, columns, loading, tableBodyY, rowKey, onRowDoubleClick } = props;

  return (
    <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0 }}>
      <Table<T>
        virtual
        rowKey={rowKey ?? ((r) => r.id)}
        columns={columns}
        dataSource={songs}
        loading={loading}
        size="middle"
        pagination={false}
        sticky
        scroll={{ y: tableBodyY }}
        onRow={(record) => {
          return {
            onDoubleClick: async () => {
              onRowDoubleClick(record);
            },
          };
        }}
      />
    </div>
  );
}
