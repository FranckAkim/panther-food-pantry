import calendarIcon from "../../../assets/stock-calendar.svg";

export function DateInput(props) {
  return (
    <span className="stock-date">
      <input className="input" type="date" {...props} />
      <img src={calendarIcon} alt="" />
    </span>
  );
}
