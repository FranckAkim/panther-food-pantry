const asset = (name) => `/assets/staff-${name}.svg`;

export const Asset = ({ name }) => <img className="sr-asset" alt="" src={asset(name)} />;
