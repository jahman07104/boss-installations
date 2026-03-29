// ─── Boss Installations - Admin Dashboard JS ───

document.addEventListener('DOMContentLoaded', () => {
  const loginScreen = document.getElementById('loginScreen');
  const dashboard = document.getElementById('dashboard');

  // ─── Check session on load ───
  checkSession();

  async function checkSession() {
    try {
      const res = await fetch('/api/admin/session');
      if (res.ok) {
        const data = await res.json();
        showDashboard(data.username);
      }
    } catch (e) {
      // Not logged in, show login screen
    }
  }

  function showDashboard(username) {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'flex';
    document.getElementById('adminUsername').textContent = username;
    loadStats();
    loadInquiries();
    loadClients();
  }

  // ─── LOGIN ───
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginError = document.getElementById('loginError');
    loginError.textContent = '';

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showDashboard(data.username);
      } else {
        loginError.textContent = data.error || 'Invalid credentials.';
      }
    } catch (err) {
      loginError.textContent = 'Connection error. Please try again.';
    }
  });

  // ─── LOGOUT ───
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    dashboard.style.display = 'none';
    loginScreen.style.display = 'flex';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  });

  // ─── TAB NAVIGATION ───
  document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;

      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');

      // Refresh data when switching tabs
      if (tab === 'overview') loadStats();
      if (tab === 'inquiries') loadInquiries();
      if (tab === 'clients') loadClients();
    });
  });

  // ─── STATS / OVERVIEW ───
  async function loadStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();

      document.getElementById('statTotalInquiries').textContent = data.totalInquiries;
      document.getElementById('statUnreadInquiries').textContent = data.unreadInquiries;
      document.getElementById('statTotalClients').textContent = data.totalClients;

      // Unread badge
      const badge = document.getElementById('unreadBadge');
      if (data.unreadInquiries > 0) {
        badge.style.display = 'inline';
        badge.textContent = data.unreadInquiries;
      } else {
        badge.style.display = 'none';
      }

      // Recent inquiries
      const recentList = document.getElementById('recentInquiriesList');
      if (data.recentInquiries.length === 0) {
        recentList.innerHTML = '<div class="empty-state">No inquiries yet</div>';
      } else {
        recentList.innerHTML = data.recentInquiries.map(i => `
          <div class="recent-item">
            <div>
              <span class="name">${esc(i.name)}</span>
              <span class="service"> — ${esc(i.service)}</span>
            </div>
            <span class="date">${formatDate(i.created_at)}</span>
          </div>
        `).join('');
      }

      // Service breakdown
      const breakdownList = document.getElementById('serviceBreakdown');
      if (data.serviceBreakdown.length === 0) {
        breakdownList.innerHTML = '<div class="empty-state">No client data yet</div>';
      } else {
        breakdownList.innerHTML = data.serviceBreakdown.map(s => `
          <div class="breakdown-item">
            <span>${esc(s.service)}</span>
            <span class="count">${s.count}</span>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  // ─── INQUIRIES ───
  let inquirySearchTimeout;
  document.getElementById('inquirySearch').addEventListener('input', (e) => {
    clearTimeout(inquirySearchTimeout);
    inquirySearchTimeout = setTimeout(() => loadInquiries(), 300);
  });

  document.getElementById('unreadOnly').addEventListener('change', () => loadInquiries());

  async function loadInquiries() {
    const search = document.getElementById('inquirySearch').value;
    const unread = document.getElementById('unreadOnly').checked;

    let url = '/api/admin/inquiries?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (unread) url += 'unread=true&';

    try {
      const res = await fetch(url);
      const inquiries = await res.json();
      const tbody = document.getElementById('inquiriesTableBody');

      if (inquiries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No inquiries found</td></tr>';
        return;
      }

      tbody.innerHTML = inquiries.map(i => `
        <tr>
          <td><span class="status-dot ${i.is_read ? '' : 'unread'}"></span></td>
          <td>${esc(i.name)}</td>
          <td>${esc(i.email)}</td>
          <td>${esc(i.service)}</td>
          <td>${formatDate(i.created_at)}</td>
          <td class="actions">
            <button class="action-btn" onclick="viewInquiry(${i.id})">View</button>
            ${!i.is_read ? `<button class="action-btn success" onclick="markRead(${i.id})">Read</button>` : ''}
            <button class="action-btn danger" onclick="deleteInquiry(${i.id})">Delete</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load inquiries:', err);
    }
  }

  window.viewInquiry = async function(id) {
    try {
      const res = await fetch('/api/admin/inquiries');
      const inquiries = await res.json();
      const inq = inquiries.find(i => i.id === id);
      if (!inq) return;

      // Mark as read
      if (!inq.is_read) {
        await fetch(`/api/admin/inquiries/${id}/read`, { method: 'PUT' });
      }

      openModal('Inquiry Details', `
        <div class="detail-row"><span class="detail-label">Name</span><span class="detail-value">${esc(inq.name)}</span></div>
        <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${esc(inq.email)}</span></div>
        <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${esc(inq.phone || 'N/A')}</span></div>
        <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${esc(inq.service)}</span></div>
        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${formatDate(inq.created_at)}</span></div>
        <div class="detail-row"><span class="detail-label">Message</span><span class="detail-value">${esc(inq.message)}</span></div>
      `);

      loadInquiries();
      loadStats();
    } catch (err) {
      console.error('Failed to view inquiry:', err);
    }
  };

  window.markRead = async function(id) {
    await fetch(`/api/admin/inquiries/${id}/read`, { method: 'PUT' });
    loadInquiries();
    loadStats();
  };

  window.deleteInquiry = async function(id) {
    if (!confirm('Delete this inquiry?')) return;
    await fetch(`/api/admin/inquiries/${id}`, { method: 'DELETE' });
    loadInquiries();
    loadStats();
  };

  // ─── CLIENTS ───
  let clientSearchTimeout;
  document.getElementById('clientSearch').addEventListener('input', () => {
    clearTimeout(clientSearchTimeout);
    clientSearchTimeout = setTimeout(() => loadClients(), 300);
  });

  document.getElementById('addClientBtn').addEventListener('click', () => {
    showClientForm();
  });

  async function loadClients() {
    const search = document.getElementById('clientSearch').value;
    let url = '/api/admin/clients?';
    if (search) url += `search=${encodeURIComponent(search)}`;

    try {
      const res = await fetch(url);
      const clients = await res.json();
      const tbody = document.getElementById('clientsTableBody');

      if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No clients found</td></tr>';
        return;
      }

      tbody.innerHTML = clients.map(c => `
        <tr>
          <td>${esc(c.name)}</td>
          <td>${esc(c.email || '—')}</td>
          <td>${esc(c.phone || '—')}</td>
          <td>${esc(c.service || '—')}</td>
          <td>${formatDate(c.created_at)}</td>
          <td class="actions">
            <button class="action-btn" onclick="editClient(${c.id})">Edit</button>
            <button class="action-btn danger" onclick="deleteClient(${c.id})">Delete</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  }

  function showClientForm(client = null) {
    const isEdit = client !== null;
    const title = isEdit ? 'Edit Client' : 'Add New Client';

    const serviceOptions = ['Network Installations', 'Camera Installations', 'PBX Systems', 'Intercom Systems', 'AC Systems', 'Solar Installation', 'Multiple Services'];

    openModal(title, `
      <form id="clientModalForm">
        <div class="form-group">
          <label>Name *</label>
          <input type="text" id="clientName" required value="${isEdit ? esc(client.name) : ''}">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="clientEmail" value="${isEdit ? esc(client.email || '') : ''}">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input type="tel" id="clientPhone" value="${isEdit ? esc(client.phone || '') : ''}">
        </div>
        <div class="form-group">
          <label>Address</label>
          <input type="text" id="clientAddress" value="${isEdit ? esc(client.address || '') : ''}">
        </div>
        <div class="form-group">
          <label>Service</label>
          <select id="clientService">
            <option value="">Select service...</option>
            ${serviceOptions.map(s => `<option value="${s}" ${isEdit && client.service === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea id="clientNotes">${isEdit ? esc(client.notes || '') : ''}</textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Update Client' : 'Add Client'}</button>
      </form>
    `);

    document.getElementById('clientModalForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('clientName').value.trim(),
        email: document.getElementById('clientEmail').value.trim(),
        phone: document.getElementById('clientPhone').value.trim(),
        address: document.getElementById('clientAddress').value.trim(),
        service: document.getElementById('clientService').value,
        notes: document.getElementById('clientNotes').value.trim()
      };

      try {
        const url = isEdit ? `/api/admin/clients/${client.id}` : '/api/admin/clients';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok && data.success) {
          closeModal();
          loadClients();
          loadStats();
        } else {
          alert(data.error || 'Failed to save client.');
        }
      } catch (err) {
        alert('Connection error.');
      }
    });
  }

  window.editClient = async function(id) {
    try {
      const res = await fetch(`/api/admin/clients/${id}`);
      const client = await res.json();
      showClientForm(client);
    } catch (err) {
      console.error('Failed to load client:', err);
    }
  };

  window.deleteClient = async function(id) {
    if (!confirm('Delete this client?')) return;
    await fetch(`/api/admin/clients/${id}`, { method: 'DELETE' });
    loadClients();
    loadStats();
  };

  // ─── CHANGE PASSWORD ───
  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('passwordStatus');
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      status.className = 'password-status error';
      status.textContent = 'New passwords do not match.';
      return;
    }

    try {
      const res = await fetch('/api/admin/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        status.className = 'password-status success';
        status.textContent = 'Password updated successfully.';
        document.getElementById('changePasswordForm').reset();
      } else {
        status.className = 'password-status error';
        status.textContent = data.error || 'Failed to update password.';
      }
    } catch (err) {
      status.className = 'password-status error';
      status.textContent = 'Connection error.';
    }
  });

  // ─── MODAL ───
  const modalOverlay = document.getElementById('modalOverlay');
  document.getElementById('modalClose').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  function openModal(title, bodyHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    modalOverlay.style.display = 'flex';
  }

  function closeModal() {
    modalOverlay.style.display = 'none';
  }

  // ─── HELPERS ───
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Make esc available globally for inline handlers
  window.esc = esc;
});
