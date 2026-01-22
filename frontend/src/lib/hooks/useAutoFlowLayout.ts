import { useCallback, useMemo } from 'react';

export interface GridConfig {
  columns: number;
  cardWidth: number;
  cardGap: number;
  rowHeight: number;
  padding: number;
}

export interface Position {
  x: number;
  y: number;
}

export function useAutoFlowLayout(itemCount: number, config: GridConfig) {
  const calculatePosition = useCallback(
    (index: number): Position => {
      const col = index % config.columns;
      const row = Math.floor(index / config.columns);
      return {
        x: col * (config.cardWidth + config.cardGap) + config.padding,
        y: row * config.rowHeight + config.padding,
      };
    },
    [config]
  );

  const gridWidth = useMemo(() => {
    return config.columns * (config.cardWidth + config.cardGap) - config.cardGap + config.padding * 2;
  }, [config]);

  const gridHeight = useMemo(() => {
    const rows = Math.ceil(itemCount / config.columns);
    return rows * config.rowHeight + config.padding * 2;
  }, [itemCount, config]);

  return {
    calculatePosition,
    gridWidth,
    gridHeight,
  };
}
