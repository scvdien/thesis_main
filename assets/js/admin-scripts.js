(function () {
    /* ========== Generic custom alert/confirm utilities ========= */
    const genericAlert = document.getElementById('genericAlert');
    const genericTitle = document.getElementById('genericAlertTitle');
    const genericMsg = document.getElementById('genericAlertMessage');
    const genericExtra = document.getElementById('genericAlertExtra');
    const btnCancel = document.getElementById('genericCancelBtn');
    const btnOk = document.getElementById('genericOkBtn');
    const btnDanger = document.getElementById('genericDangerBtn');

    function _hideAllGenericButtons() {
      btnCancel.style.display = 'none';
      btnOk.style.display = 'none';
      btnDanger.style.display = 'none';
    }

    function _showGenericOverlay() {
      genericAlert.style.display = 'flex';
      genericAlert.setAttribute('aria-hidden', 'false');
      // focus appropriate button
      setTimeout(()=> {
        const toFocus = (btnOk.style.display !== 'none' ? btnOk : (btnCancel.style.display !== 'none' ? btnCancel : btnDanger));
        try { toFocus.focus(); } catch(e) {}
      }, 40);
    }

    function _closeGenericOverlay() {
      genericAlert.style.display = 'none';
      genericAlert.setAttribute('aria-hidden', 'true');
      // cleanup handlers
      btnOk.onclick = null;
      btnCancel.onclick = null;
      btnDanger.onclick = null;
      document.onkeydown = null;
      genericAlert.onclick = null;
    }

    // showAlert: simple OK box (returns a Promise resolved when user closes)
    window.showAlert = function({ title = 'Notice', message = '', extra = '' } = {}) {
      return new Promise((resolve) => {
        _hideAllGenericButtons();
        genericTitle.textContent = title;
        genericMsg.innerHTML = message;
        genericExtra.textContent = extra || '';
        btnOk.textContent = 'OK';
        btnOk.style.display = '';
        btnOk.onclick = () => { _closeGenericOverlay(); resolve(); };
        // allow cancel via overlay click or ESC
        genericAlert.onclick = (e) => { if (e.target === genericAlert) { _closeGenericOverlay(); resolve(); } };
        document.onkeydown = (e) => { if (e.key === 'Escape') { _closeGenericOverlay(); resolve(); } };
        _showGenericOverlay();
      });
    };

    // showConfirm: returns Promise<boolean>
    window.showConfirm = function({ title = 'Confirm', message = '', confirmText = 'Yes', cancelText = 'Cancel', danger = false } = {}) {
      return new Promise((resolve) => {
        _hideAllGenericButtons();
        genericTitle.textContent = title;
        genericMsg.innerHTML = message;
        genericExtra.textContent = '';
        if (danger) {
          btnDanger.textContent = confirmText;
          btnDanger.style.display = '';
        } else {
          btnOk.textContent = confirmText;
          btnOk.style.display = '';
        }
        btnCancel.textContent = cancelText;
        btnCancel.style.display = '';

        btnCancel.onclick = () => { _closeGenericOverlay(); resolve(false); };
        const okHandler = () => { _closeGenericOverlay(); resolve(true); };
        const dangerHandler = () => { _closeGenericOverlay(); resolve(true); };

        btnOk.onclick = okHandler;
        btnDanger.onclick = dangerHandler;

        genericAlert.onclick = (e) => { if (e.target === genericAlert) { _closeGenericOverlay(); resolve(false); } };
        document.onkeydown = (e) => { if (e.key === 'Escape') { _closeGenericOverlay(); resolve(false); } };

        _showGenericOverlay();
      });
    };

    /* ========== Sidebar toggle + overlay behavior ========= */
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    const toggleIcon = document.getElementById('toggleIcon');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    // helper to update icon
    function setToggleIcon(collapsed) {
      // collapsed true => sidebar hidden -> show 'bi-list' (open icon)
      if (collapsed) toggleIcon.className = 'bi bi-list';
      else toggleIcon.className = 'bi bi-x';
    }

    // restore state from localStorage (optional)
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') {
      sidebar.classList.add('collapsed');
      sidebar.setAttribute('aria-hidden', 'true');
      setToggleIcon(true);
    } else {
      setToggleIcon(false);
    }

    // show overlay on small screens when sidebar is open
    function updateOverlay() {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      const visible = !sidebar.classList.contains('collapsed') && isMobile;
      if (visible) {
        sidebarOverlay.classList.add('visible');
        sidebarOverlay.setAttribute('aria-hidden','false');
      } else {
        sidebarOverlay.classList.remove('visible');
        sidebarOverlay.setAttribute('aria-hidden','true');
      }
    }

    toggleBtn.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      sidebar.setAttribute('aria-hidden', isCollapsed ? 'true' : 'false');
      setToggleIcon(isCollapsed);
      localStorage.setItem('sidebarCollapsed', String(isCollapsed));
      updateOverlay();
    });

    // clicking overlay should close sidebar on mobile
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.add('collapsed');
      sidebar.setAttribute('aria-hidden','true');
      setToggleIcon(true);
      localStorage.setItem('sidebarCollapsed','true');
      updateOverlay();
    });

    // close sidebar with Escape (only when mobile overlay is visible)
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        if (!sidebar.classList.contains('collapsed') && isMobile) {
          sidebar.classList.add('collapsed');
          sidebar.setAttribute('aria-hidden','true');
          setToggleIcon(true);
          localStorage.setItem('sidebarCollapsed','true');
          updateOverlay();
        }
      }
    });

    // update overlay on resize
    window.addEventListener('resize', updateOverlay);
    updateOverlay();

    /* ========== Charts rendering logic ========= */
    // (kept mostly intact from your version; initialize placeholders)
    window._demographicCharts = window._demographicCharts || {};

    function destroyIfExists(key) {
      if (window._demographicCharts[key]) {
        try { window._demographicCharts[key].destroy(); } catch(e) {}
        window._demographicCharts[key] = null;
      }
    }

    function doughnutConfig(labels, values) {
      return {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12 } },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  const v = ctx.parsed;
                  const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
                  const pct = total ? ((v/total)*100).toFixed(1) + '%' : '0%';
                  return `${ctx.label}: ${v.toLocaleString()} (${pct})`;
                }
              }
            }
          }
        }
      };
    }

    function barConfig(labels, values, opts = {}) {
      return {
        type: 'bar',
        data: { labels, datasets: [{ label: opts.label || 'Count', data: values }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
          scales: {
            x: { ticks: { maxRotation: 0, autoSkip: true } },
            y: { beginAtZero: true }
          }
        }
      };
    }

    function horizontalBarConfig(labels, values, opts = {}) {
      return {
        type: 'bar',
        data: { labels, datasets: [{ label: opts.label || 'Count', data: values }] },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true }, y: { ticks: { autoSkip: false } } }
        }
      };
    }

    function setChartSummary(id, text) {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      const card = canvas.closest('.chart-card');
      if (!card) return;
      const summaryEl = card.querySelector('.chart-summary');
      if (summaryEl) summaryEl.textContent = text;
    }

    window.renderAllDemographicCharts = function (data) {
      // Age
      (function () {
        const labels = ['0–12','13–17','18–35','36–59','60+'];
        const keys   = ['age_0_12','age_13_17','age_18_35','age_36_59','age_60_plus'];
        const values = keys.map(k => (data && data.age && Number(data.age[k])) ? Number(data.age[k]) : 0);
        destroyIfExists('age');
        window._demographicCharts.age = new Chart(document.getElementById('chart_age').getContext('2d'), barConfig(labels, values, { label: 'Population' }));
        setChartSummary('chart_age', (values.reduce((a,b)=>a+b,0) === 0) ? 'No data yet' : 'Groups: 0–12, 13–17, 18–35, 36–59, 60+');
      })();

      // Gender
      (function () {
        const labels = ['Male','Female','Others'];
        const male = (data && data.gender && Number(data.gender.male)) ? Number(data.gender.male) : 0;
        const female = (data && data.gender && Number(data.gender.female)) ? Number(data.gender.female) : 0;
        const others = (data && data.gender && Number(data.gender.others)) ? Number(data.gender.others) : 0;
        destroyIfExists('gender');
        window._demographicCharts.gender = new Chart(document.getElementById('chart_gender').getContext('2d'), doughnutConfig(labels, [male, female, others]));
        setChartSummary('chart_gender', (male+female+others === 0) ? 'No data yet' : 'Male / Female / Others');
      })();

      // Civil
      (function () {
        const labels = ['Single','Married','Widowed','Separated'];
        const cs = (data && data.civil) ? data.civil : {};
        const values = [cs.single||0, cs.married||0, cs.widowed||0, cs.separated||0].map(Number);
        destroyIfExists('civil');
        window._demographicCharts.civil = new Chart(document.getElementById('chart_civil').getContext('2d'), doughnutConfig(labels, values));
        setChartSummary('chart_civil', (values.reduce((a,b)=>a+b,0) === 0) ? 'No data yet' : 'Single / Married / Widowed / Separated');
      })();

      // Education (horizontal)
      (function () {
        const labels = ['No Formal Education','Elementary','High School','Vocational/Technical','College'];
        const edu = (data && data.education) ? data.education : {};
        const values = [edu.none||0, edu.elementary||0, edu.highschool||0, edu.vocational||0, edu.college||0].map(Number);
        destroyIfExists('education');
        window._demographicCharts.education = new Chart(document.getElementById('chart_education').getContext('2d'), horizontalBarConfig(labels, values));
        setChartSummary('chart_education', (values.reduce((a,b)=>a+b,0) === 0) ? 'No data yet' : 'Elementary, High School, College, Vocational, None');
      })();

      // Employment
      (function () {
        const labels = ['Employed','Unemployed','Self-Employed','Student','Retired'];
        const emp = (data && data.employment) ? data.employment : {};
        const values = [emp.employed||0, emp.unemployed||0, emp.self||0, emp.student||0, emp.retired||0].map(Number);
        destroyIfExists('employment');
        window._demographicCharts.employment = new Chart(document.getElementById('chart_employment').getContext('2d'), barConfig(labels, values));
        setChartSummary('chart_employment', (values.reduce((a,b)=>a+b,0) === 0) ? 'No data yet' : 'Employed / Unemployed / Self-Employed / Student / Retired');
      })();

      // Religion
      (function () {
        const labels = ['Roman Catholic','Iglesia ni Cristo','Born Again','Muslim','Others'];
        const rel = (data && data.religion) ? data.religion : {};
        const values = [rel.roman||0, rel.inc||0, rel.bornagain||0, rel.muslim||0, rel.others||0].map(Number);
        destroyIfExists('religion');
        window._demographicCharts.religion = new Chart(document.getElementById('chart_religion').getContext('2d'), doughnutConfig(labels, values));
        setChartSummary('chart_religion', (values.reduce((a,b)=>a+b,0) === 0) ? 'No data yet' : 'Top religions');
      })();

      // 4ps
      (function () {
        const labels = ['Member','Not a Member'];
        const m = (data && data.fourPs) ? data.fourPs : {};
        const values = [m.member||0, m.notMember||0].map(Number);
        destroyIfExists('4ps');
        window._demographicCharts['4ps'] = new Chart(document.getElementById('chart_4ps').getContext('2d'), doughnutConfig(labels, values));
        setChartSummary('chart_4ps', (values.reduce((a,b)=>a+b,0) === 0) ? 'No data yet' : 'Member vs Not a Member');
      })();

      // voters
      (function () {
        const labels = ['Registered','Not Registered'];
        const v = (data && data.voters) ? data.voters : {};
        const values = [v.registered||0, v.notRegistered||0].map(Number);
        destroyIfExists('voters');
        window._demographicCharts.voters = new Chart(document.getElementById('chart_voters').getContext('2d'), doughnutConfig(labels, values));
        setChartSummary('chart_voters', (values.reduce((a,b)=>a+b,0) === 0) ? 'No data yet' : 'Registered vs Not Registered');
      })();

      // blood
      (function () {
        const labels = ['A','B','AB','O'];
        const b = (data && data.blood) ? data.blood : {};
        const values = [b.A||0, b.B||0, b.AB||0, b.O||0].map(Number);
        destroyIfExists('blood');
        window._demographicCharts.blood = new Chart(document.getElementById('chart_blood').getContext('2d'), doughnutConfig(labels, values));
        setChartSummary('chart_blood', (values.reduce((a,b)=>a+b,0) === 0) ? 'No data yet' : 'A / B / AB / O');
      })();

      // pwd
      (function () {
        const labels = ['Yes','No'];
        const p = (data && data.pwd) ? data.pwd : {};
        const values = [p.yes||0, p.no||0].map(Number);
        destroyIfExists('pwd');
        window._demographicCharts.pwd = new Chart(document.getElementById('chart_pwd').getContext('2d'), doughnutConfig(labels, values));
        setChartSummary('chart_pwd', (values.reduce((a,b)=>a+b,0) === 0) ? 'No data yet' : 'Yes / No');
      })();
    };

    function initEmptyCharts() {
      window.renderAllDemographicCharts({});
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initEmptyCharts);
    } else {
      initEmptyCharts();
    }

    /* ========== Replace native confirm for logout and wire buttons ========== */
    const logoutBtn = document.getElementById('logoutBtnSidebar');

    logoutBtn.addEventListener('click', async () => {
      const ok = await window.showConfirm({
        title: 'Confirm Logout',
        message: 'Are you sure you want to logout?',
        confirmText: 'Logout',
        cancelText: 'Cancel',
        danger: true
      });
      if (ok) {
        // redirect to login (keep same behavior)
        window.location.href = 'login.php';
      }
    });

    // Example: replace refresh button behavior to show a small confirm (optional)
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', async () => {
      // simple demo: show loading alert then call load (you can adapt)
      await window.showAlert({ title: 'Refreshing', message: 'Refreshing data...' });
      // call your data refresh function here (e.g., window.loadDemographicsFromApi('/api/...'))
      // For demo, we just re-init placeholder charts
      initEmptyCharts();
    });

    // You can call showAlert/showConfirm from other scripts (global functions)
  })();