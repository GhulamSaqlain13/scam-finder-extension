const input = document.getElementById("message");
function analyze() {
  if (!input.value.trim()) { input.setCustomValidity("Enter a message."); input.reportValidity(); return; }
  input.setCustomValidity("");
  const result = globalThis.fsdAnalyze(input.value);
  document.getElementById("risk").textContent = globalThis.fsdDisplayRisk(result.score);
  document.getElementById("categories").textContent = globalThis.fsdCategoryLabels(result.signals).join(". ");
  document.getElementById("signals").replaceChildren(...result.indicators.map(indicator => {
    const li = document.createElement("li"); li.textContent = indicator.explanation + " (+" + indicator.points + " points). " + indicator.action; return li;
  }));
  document.getElementById("explanation").textContent = result.sensitiveRequests.length
    ? result.sensitiveRequests.map(request => request.explanation + " " + request.action).join(" ")
    : result.externalCommunication ? result.externalCommunication.explanation + " This is a risk indicator, not proof of a scam."
    : result.score ? "Review these warning signs before replying. This is a heuristic score, not a probability." : "No known rule matched. Stay cautious.";
}
input.addEventListener("input", () => {
  input.setCustomValidity("");
  document.getElementById("risk").textContent = "Message changed — analyze again";
  document.getElementById("signals").replaceChildren();
  document.getElementById("categories").textContent = "";
  document.getElementById("explanation").textContent = "";
});
document.getElementById("tester").addEventListener("submit", event => { event.preventDefault(); analyze(); });
const samples = [
  ["Project", "Please deliver the logo through Fiverr by Friday."],
  ["OTP request", "Send me your six digit code immediately."],
  ["Payment verification", "Enter your debit card information on this verification page so your Fiverr payment can be released."],
  ["Safety advice", "Do not send anyone your password or OTP."],
];
for (const [label, text] of samples) {
  const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = label;
  button.addEventListener("click", () => { input.value = text; analyze(); });
  document.getElementById("samples").append(button);
}
