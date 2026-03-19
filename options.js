document.getElementById("saveBtn").addEventListener("click", () => {
  const setting = document.getElementById("settingInput").value;
  chrome.storage.sync.set({ setting }, () => {
    alert("Saved setting: " + setting);
  });
});
