// "At this rate you reach X kg around <date>": the goal-weight readout under
// the weight coach. `eta` comes from goalEta() in domain/weight.js.
const fmtDate = (key) => new Date(key + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function GoalEta({ eta, targetKg }) {
  if (!eta || !targetKg) return null;
  const colour = eta.status === 'on-course' || eta.status === 'reached' ? '#4caf7d' : '#e8a13a';
  let text;
  if (eta.status === 'reached') text = `You're at your goal weight of ${targetKg} kg.`;
  else if (eta.status === 'on-course') text = `${Math.abs(eta.toGo)} kg to go. At this rate you reach ${targetKg} kg around ${fmtDate(eta.date)} (about ${eta.weeks} week${eta.weeks === 1 ? '' : 's'}).`;
  else if (eta.status === 'too-slow') text = `${Math.abs(eta.toGo)} kg to go, but at this rate it is over two years away.`;
  else if (eta.status === 'off-course') text = `${Math.abs(eta.toGo)} kg to go, and the trend isn't moving toward ${targetKg} kg yet.`;
  else text = `${Math.abs(eta.toGo)} kg to go. Log a few more weigh-ins over a week or more to project a date.`;
  return <div role="status" style={{ fontSize: 13, lineHeight: 1.5, color: colour }}>{text}</div>;
}
