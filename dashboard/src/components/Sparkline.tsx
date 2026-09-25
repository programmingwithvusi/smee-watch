import { sparkGeometry } from "../lib/spark";

interface Props {
  values: readonly number[];
  /** Screen-reader description, e.g. "Closing prices over the last month" */
  label: string;
  width?: number;
  height?: number;
}

export function Sparkline({ values, label, width = 132, height = 44 }: Props) {
  const { path, last } = sparkGeometry(values, width, height);
  if (!path || !last) return <span className="spark spark--empty">No history</span>;
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="none">
      <path className="spark__line" d={path} fill="none" vectorEffect="non-scaling-stroke" />
      <circle className="spark__end" cx={last.x} cy={last.y} r="3" />
    </svg>
  );
}
