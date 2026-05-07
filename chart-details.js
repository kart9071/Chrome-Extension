document.getElementById("closeBtn").addEventListener("click", () => window.close());

const urlParams = new URLSearchParams(window.location.search);
const member_id = urlParams.get("member_id");
const member_name = urlParams.get("member_name");

document.getElementById("heading").textContent = `Chart Details - ${member_name}`;
const contentDiv = document.getElementById("content");

chrome.runtime.sendMessage(
  { action: "fetchChartDetails", payload: { member_id, member_name } },
  (response) => {
    if (chrome.runtime.lastError) {
      contentDiv.innerHTML = `<p style="color:red;">Error: ${chrome.runtime.lastError.message}</p>`;
      return;
    }

    if (!response) {
      contentDiv.innerHTML = `<p style="color:red;">No response from background script.</p>`;
      return;
    }

    if (response.error) {
      contentDiv.innerHTML = `<p style="color:red;">❌ ${response.error}</p>`;
      return;
    }

    const data = response.data;
    if (!data) {
      contentDiv.innerHTML = `<p>No chart details available</p>`;
      return;
    }

    // Clear loading
    contentDiv.innerHTML = "";

    // Patient Info
    const patient = data.chart_response?.data?.member;
    if (patient) {
      const section = document.createElement("section");
      section.innerHTML = `
        <h3>Patient Info</h3>
        <p><strong>Name:</strong> ${patient.fname} ${patient.lname}</p>
        <p><strong>DOB:</strong> ${patient.DOB}</p>
        <p><strong>EMR Chart #:</strong> ${patient.emr_chart_number}</p>
        <p><strong>PCP:</strong> ${patient.pcp?.name || "N/A"}</p>
      `;
      contentDiv.appendChild(section);
    }

    // Appointment Info
    const appt = data.chart_response?.data?.appointment;
    if (appt) {
      const section = document.createElement("section");
      section.innerHTML = `
        <h3>Appointment Info</h3>
        <p><strong>Date of Service:</strong> ${new Date(appt.DOS).toLocaleDateString()}</p>
        <p><strong>Facility:</strong> ${appt.facility}</p>
      `;
      contentDiv.appendChild(section);
    }

    // Medical Conditions
    const conditions = data.chart_response?.data?.medical_conditions || [];
    if (conditions.length > 0) {
      const section = document.createElement("section");
      section.innerHTML = `<h3>Medical Conditions</h3>`;
      conditions.forEach((cond) => {
        const div = document.createElement("div");
        div.className = "medical-condition";
        div.innerHTML = `
          <p><strong>Condition:</strong> ${cond.condition_name}</p>
          <p><strong>ICD Code:</strong> ${cond.icd_code}</p>
          <p><strong>Clinical Indicators:</strong> ${cond.clinical_indicators}</p>
          <p><strong>Documentation:</strong> ${cond.documented_in}</p>
          <p><strong>Code Status:</strong> ${cond.code_status}</p>
           <p><strong>Code Explanation:</strong> ${cond.code_explanation}</p>
        `;
        section.appendChild(div);
      });
      contentDiv.appendChild(section);
    }
  }
);
