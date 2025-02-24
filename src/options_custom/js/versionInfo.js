import { BUILD_TIMESTAMP } from '../../js/buildInfo.js';

function addVersionInfo() {
    const version = chrome.runtime.getManifest().version;
    const footer = document.createElement('div');
    footer.style.position = 'fixed';
    footer.style.bottom = '8px';
    footer.style.left = '10px';
    footer.style.right = '10px';
    footer.style.color = '#666';
    footer.style.fontSize = '12px';
    footer.style.textAlign = 'center';
    footer.innerHTML = `<br>Version: ${version}<br>Built at: ${BUILD_TIMESTAMP}`;
    document.body.appendChild(footer);
}

document.addEventListener('DOMContentLoaded', addVersionInfo);
