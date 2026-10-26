/**
 * SECTIONS.JS - Interactive enhancements for documentation sections
 * Tab switching, code copying, etc. (does not interfere with doorbell app.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Code Tab Switching (RTL vs Testbench) ──
  const codeTabs = document.querySelectorAll('.code-tab');
  const panels = {
    'rtl-code': document.getElementById('rtl-code'),
    'tb-code': document.getElementById('tb-code')
  };

  codeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      codeTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.target;
      Object.keys(panels).forEach(key => {
        if (panels[key]) {
          panels[key].style.display = (key === target) ? 'block' : 'none';
        }
      });
    });
  });

  // ── Copy Code to Clipboard ──
  const copyBtn = document.getElementById('copyCodeBtn');
  const copyLabel = document.getElementById('copyLabel');

  if (copyBtn && copyLabel) {
    copyBtn.addEventListener('click', () => {
      const activeTab = document.querySelector('.code-tab.active');
      const targetId = activeTab ? activeTab.dataset.target : 'rtl-code';
      const targetPanel = panels[targetId];
      if (!targetPanel) return;

      const codeText = targetPanel.querySelector('code').innerText;
      navigator.clipboard.writeText(codeText).then(() => {
        copyLabel.textContent = 'Copied!';
        copyBtn.style.borderColor = '#22c55e';
        copyBtn.style.color = '#15803d';

        setTimeout(() => {
          copyLabel.textContent = 'Copy';
          copyBtn.style.borderColor = '';
          copyBtn.style.color = '';
        }, 2000);
      }).catch(err => {
        console.warn('Clipboard write failed:', err);
      });
    });
  }
});
