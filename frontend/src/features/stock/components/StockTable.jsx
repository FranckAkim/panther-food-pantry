export function StockTable({ children, className = "" }) {
  return (
    <div className={`table-wrap stock-table-wrap ${className}`}>
      <table className="data-table stock-table">{children}</table>
    </div>
  );
}
