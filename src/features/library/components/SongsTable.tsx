import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { RefObject } from 'react';

import type { UnifiedSong } from '../types';

export function SongsTable(props: {
  tableWrapRef: RefObject<HTMLDivElement | null>;
  songs: UnifiedSong[];
  columns: ColumnsType<UnifiedSong>;
  loading: boolean;
  tableBodyY: number;
  onRowDoubleClick: (row: UnifiedSong) => void;
}) {
  const { tableWrapRef, songs, columns, loading, tableBodyY, onRowDoubleClick } = props;

  return (
    <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0 }}>
      <Table<UnifiedSong>
        virtual
        rowKey={(r) => r.id}
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
