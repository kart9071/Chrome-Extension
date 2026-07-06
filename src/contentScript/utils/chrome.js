/* global chrome */

function sendMessage(action, payload) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage({ action, payload }, (response) => {
        if (chrome.runtime.lastError)
          return reject(new Error(chrome.runtime.lastError.message));
        if (!response)
          return reject(new Error('No response from service worker'));
        if (response.error) return reject(new Error(response.error));
        resolve(response.data);
      });
    } catch (err) {
      reject(err);
    }
  });
}

export const fetchChartDetails = (member_id, member_name) =>
  sendMessage('fetchChartDetails', { member_id, member_name });

export const fetchAuditDetails = (member_id, member_name) =>
  sendMessage('fetchAuditDetails', { member_id, member_name });

export const fetchMRAnalysis = (member_id, member_name) =>
  sendMessage('fetchMRAnalysis', { member_id, member_name });

export const fetchDqaDetails = (member_id, member_name) =>
  sendMessage('fetchDqaDetails', { member_id, member_name });
