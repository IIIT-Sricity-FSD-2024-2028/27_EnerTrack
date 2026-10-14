/**
 * TaskFlow — the four numbered steps under a selected work order, lit up
 * from step 1 to the step matching its status.
 *
 * Shared by the Technician Administrator and Technician Jr work-order pages.
 *
 * Ported from updateTaskFlow() in js/technician/workOrdersPage.js.
 */

const STEPS = [
  { title: "Assigned", text: "New task assigned to technician." },
  { title: "Approval", text: "Cost/parts estimate sent to finance." },
  { title: "In Progress", text: "Technician is executing repair." },
  { title: "Review & Close", text: "QA passed and ready for closure." },
];

/** How many steps are done: 0 = only step 1 lit, 3 = all four lit. */
function lastLitStep(status) {
  if (status === "new") {
    return 0;
  }
  if (status === "approval") {
    return 1;
  }
  if (status === "inprogress") {
    return 2;
  }
  return 3; // review or closed
}

export default function TaskFlow({ status }) {
  const lastLit = lastLitStep(status);

  return (
    <div className="card no-margin">
      <h2 className="section-title-small mb-12">Task Execution Flow</h2>
      <div className="task-execution-flow">
        {STEPS.map((step, index) => {
          let boxClass = "step-box";
          if (index <= lastLit) {
            boxClass = "step-box active";
          }

          return (
            <div key={step.title} className={boxClass}>
              <div className="step-num">{index + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
