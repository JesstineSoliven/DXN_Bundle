// Team (owner only): invite staff/owners, change roles, turn access off/on, resend invite or reset link.
import { admin } from '../api.js';
import { icon, esc, fmtDate, pageHead, toast, fieldErrors, reload } from '../ui.js';

export default {
  title: 'Team',
  owner: true,
  load: () => admin.get('users'),
  render({ users }, _p, me) {
    return `
    ${pageHead('Team', 'Everyone who can sign in to this admin. Owners can also manage the team and see System.')}
    <form class="card p-4 flex flex-wrap items-end gap-3 mb-4" data-invite novalidate>
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute flex-1 min-w-[180px]">Name
        <input name="name" class="adm-input" maxlength="80" placeholder="Ana Reyes" required></label>
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute flex-1 min-w-[220px]">Email
        <input name="email" type="email" class="adm-input" maxlength="254" placeholder="ana@example.com" required></label>
      <label class="flex flex-col gap-1 text-[12px] font-semibold text-ink-mute">Role
        <select name="role" class="adm-input min-w-[120px]"><option value="staff">Staff</option><option value="owner">Owner</option></select></label>
      <button type="submit" class="btn btn-green btn-sm h-9">${icon('plus', 'w-4 h-4', 2.4)}Send invite</button>
    </form>
    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead><tr><th>Person</th><th>Role</th><th>Last sign-in</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody data-rows>
          ${users.map((u) => {
            const self = u.id === me.id;
            return `
          <tr data-id="${u.id}" class="${u.active ? '' : 'is-muted'}">
            <td><span class="font-semibold">${esc(u.name)}${self ? ' <span class="text-ink-mute font-normal">(you)</span>' : ''}</span><span class="block text-[12px] text-ink-mute break-all">${esc(u.email)}</span></td>
            <td><label class="sr-only" for="role-${u.id}">Role</label>
              <select id="role-${u.id}" class="adm-input w-[110px]" data-role ${self ? 'disabled title="You can’t change your own role"' : ''}>
                <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option><option value="owner" ${u.role === 'owner' ? 'selected' : ''}>Owner</option>
              </select></td>
            <td class="whitespace-nowrap">${u.invitePending ? '<span class="st st-pending">Invite pending</span>' : fmtDate(u.lastLoginAt)}</td>
            <td><label class="inline-flex items-center gap-2 text-[13px] font-semibold ${self ? 'opacity-50' : 'cursor-pointer'}">
              <input type="checkbox" class="w-4 h-4 accent-[#1A552E]" data-active ${u.active ? 'checked' : ''} ${self ? 'disabled' : ''}>${u.active ? 'Active' : 'Off'}</label></td>
            <td class="text-right whitespace-nowrap">${u.active ? `<button type="button" class="btn btn-ghost btn-sm" data-resend>${u.invitePending ? 'Resend invite' : 'Send reset link'}</button>` : ''}</td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="text-[12px] text-ink-mute mt-3">Turning someone off signs them out everywhere immediately. Invite links last 3 days; reset links 1 hour.</p>`;
  },
  mount(root) {
    const form = root.querySelector('[data-invite]');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try {
        const { user } = await admin.post('users', { name: form.name.value, email: form.email.value, role: form.role.value });
        toast(`Invite sent to ${user.email}`); reload();
      } catch (err) { btn.disabled = false; fieldErrors(form, err); toast(err.message, 'error'); }
    });
    const tbody = root.querySelector('[data-rows]');
    tbody.addEventListener('change', async (e) => {
      const id = e.target.closest('tr').dataset.id;
      const body = e.target.matches('[data-role]') ? { role: e.target.value } : e.target.matches('[data-active]') ? { active: e.target.checked } : null;
      if (!body) return;
      try { await admin.patch(`users/${id}`, body); toast('Saved'); reload(); }
      catch (err) { toast(err.message, 'error'); reload(); }
    });
    tbody.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-resend]');
      if (!b) return;
      b.disabled = true;
      try { await admin.post(`users/${b.closest('tr').dataset.id}/invite`, {}); toast('Email sent'); }
      catch (err) { toast(err.message, 'error'); } finally { b.disabled = false; }
    });
    return null;
  },
};
